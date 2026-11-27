'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import CoBar from '@/components/CoBar';
import { sb, fmtDate } from '@/lib/supabase';
import { useCoPick, money, r3, todayISO, addDays, CO_CODE } from '@/lib/coPick';
import { withEditPassword } from '@/lib/editLock';
import { loadSellers, sellerFor, newUuid, buyerType, paperPdf } from '@/lib/einvoice';

/*
  📝 Quotations (27 Nov 2026, Kamran). Table quotations (database/12_crm_quotes_leave.sql).
  - Every company has its own quotes, numbered QT-AN-0001, QT-SH-0001 ... (added companies QT-X-0001).
  - Lines: description, quantity, unit price. Discount, VAT % (5 by default), terms.
  - Status: Draft, Sent, Accepted, Rejected, Invoiced.
  - 🧾 Convert to invoice: makes a normal invoice in Invoices (company_docs, e-invoice ready, next INV number),
    the quote becomes Invoiced and keeps the invoice number. The customer in CRM becomes Won.
  - Opened from CRM with ?new=<customer id>: the customer's details are filled in.
*/

const STATUS = {
  draft: { label: 'Draft', cls: 'neutral' },
  sent: { label: 'Sent', cls: 'qm-blue' },
  accepted: { label: 'Accepted', cls: 'ok' },
  rejected: { label: 'Rejected', cls: 'low' },
  invoiced: { label: 'Invoiced', cls: 'qm-gold' }
};
const TERMS = 'Prices are in Omani Rials (OMR).\nPayment: 50% advance, 50% on delivery.\nThis quotation is valid until the date shown above.';
const num = (v) => Number(v || 0);
const lineAmt = (i) => r3(num(i.qty) * num(i.price));
const pad4 = (v) => String(v).padStart(4, '0');
const maxNo = (rows, field) => (rows || []).reduce((mx, d) => { const m = String(d[field] || '').match(/(\d+)\s*$/); return m ? Math.max(mx, Number(m[1])) : mx; }, 0);

function quoteTotals(q) {
  const items = r3((q.items || []).reduce((t, i) => t + lineAmt(i), 0));
  const disc = r3(q.discount);
  const net = r3(items - disc);
  const vat = r3((net * num(q.vat_pct)) / 100);
  return { items, disc, net, vat, tot: r3(net + vat) };
}

const blankLine = () => ({ desc: '', qty: '1', price: '' });

function Quotes() {
  const user = useUser();
  const me = user.name || user.username;
  const pick = useCoPick(user, '/expenses/quotes');
  const { co, company: C } = pick;
  const [list, setList] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState(null); // edit / new
  const [view, setView] = useState(null); // paper
  const [filter, setFilter] = useState('');
  const [find, setFind] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const paperRef = useRef(null);
  const canWrite = !!user.isAdmin;

  async function load() {
    if (!co) return;
    setList(null);
    const s = sb();
    const [q, c] = await Promise.all([
      s.from('quotations').select('*').eq('company', co).order('quote_date', { ascending: false }).order('created_at', { ascending: false }),
      s.from('crm_contacts').select('id, name, contact_person, phone, email, address, vat_no, stage').eq('company', co).order('name')
    ]);
    if (q.error) { setMsg(/quotations|does not exist|schema cache/i.test(q.error.message) ? 'The Quotations table is not in the database yet. Run database/12_crm_quotes_leave.sql in Supabase.' : q.error.message); setList([]); return; }
    setList(q.data || []);
    setContacts(c.data || []);
    return { quotes: q.data || [], contacts: c.data || [] };
  }

  // first load: also open ?id= or ?new= (from CRM)
  useEffect(() => {
    if (!co) return;
    setForm(null); setView(null);
    load().then((r) => {
      if (!r) return;
      let p; try { p = new URLSearchParams(window.location.search); } catch { return; }
      const id = p.get('id'); const nw = p.get('new');
      if (id) { const q = r.quotes.find((x) => x.id === id); if (q) setView(q); }
      else if (nw && canWrite) { const c = r.contacts.find((x) => x.id === nw); newQuote(r.quotes, c); }
      try { p.delete('id'); p.delete('new'); window.history.replaceState(null, '', `/expenses/quotes?${p.toString()}`); } catch { /* ignore */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [co]);

  function newQuote(rows = list, contact = null) {
    const no = `QT-${CO_CODE[co] || 'X'}-${pad4(maxNo(rows, 'quote_no') + 1)}`;
    const last = (rows || [])[0];
    withEditPassword(() => {
      setView(null);
      setForm({
        id: null, quote_no: no, quote_date: todayISO(), valid_until: addDays(todayISO(), 15),
        contact_id: contact?.id || null, party: contact?.name || '',
        party_details: contact ? [contact.contact_person, contact.phone, contact.email, contact.address].filter(Boolean).join('\n') : '',
        party_vat: contact?.vat_no || '', items: [blankLine(), blankLine()], discount: '', vat_pct: last ? String(last.vat_pct) : '5',
        notes: '', terms: last?.terms || TERMS, status: 'draft'
      });
    });
  }

  function editQuote(q) {
    if (q.status === 'invoiced') { setMsg('This quote is already an invoice. Make a new quote to change it.'); return; }
    withEditPassword(() => {
      setView(null);
      setForm({ ...q, discount: q.discount ? String(q.discount) : '', vat_pct: String(q.vat_pct), items: (q.items || []).map((i) => ({ desc: i.desc || '', qty: String(i.qty ?? ''), price: String(i.price ?? '') })) });
    });
  }

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));

  function pickParty(v) {
    const c = contacts.find((x) => x.name.toLowerCase() === v.trim().toLowerCase());
    setForm((f) => (c ? {
      ...f, party: c.name, contact_id: c.id, party_vat: f.party_vat || c.vat_no || '',
      party_details: f.party_details || [c.contact_person, c.phone, c.email, c.address].filter(Boolean).join('\n')
    } : { ...f, party: v, contact_id: null }));
  }

  async function save(e) {
    e.preventDefault();
    const items = form.items.map((i) => ({ desc: String(i.desc || '').trim(), qty: num(i.qty), price: r3(i.price) })).filter((i) => i.desc || i.price);
    if (!form.party.trim()) { setMsg('Type the client name.'); return; }
    if (!items.length) { setMsg('Add at least one line.'); return; }
    setBusy(true); setMsg('');
    const row = {
      company: co, quote_no: form.quote_no || null, quote_date: form.quote_date || todayISO(), valid_until: form.valid_until || null,
      contact_id: form.contact_id || null, party: form.party.trim(), party_details: form.party_details || null, party_vat: form.party_vat || null,
      items, discount: r3(form.discount), vat_pct: num(form.vat_pct), notes: form.notes || null, terms: form.terms || null,
      status: form.status || 'draft', updated_at: new Date().toISOString()
    };
    const s = sb().from('quotations');
    const res = form.id ? await s.update(row).eq('id', form.id).select().single() : await s.insert({ ...row, created_by: me }).select().single();
    setBusy(false);
    if (res.error) { setMsg(res.error.message); return; }
    // CRM: a customer with a quote moves to Quoted
    const c = contacts.find((x) => x.id === row.contact_id);
    if (c && ['lead', 'contacted'].includes(c.stage)) await sb().from('crm_contacts').update({ stage: 'quoted', updated_at: new Date().toISOString() }).eq('id', c.id);
    setForm(null); setMsg(form.id ? '✓ Saved' : '✓ Quote made');
    await load();
    setView(res.data);
  }

  async function setStatus(q, status) {
    const { data, error } = await sb().from('quotations').update({ status, updated_at: new Date().toISOString() }).eq('id', q.id).select().single();
    if (error) { setMsg(error.message); return; }
    if (q.contact_id && (status === 'accepted' || status === 'rejected')) {
      await sb().from('crm_contacts').update({ stage: status === 'accepted' ? 'won' : 'lost', updated_at: new Date().toISOString() }).eq('id', q.contact_id);
    }
    setMsg(`✓ ${STATUS[status].label}`);
    setView(data); load();
  }

  async function toInvoice(q) {
    if (q.invoice_id) return;
    if (!window.confirm(`Make an invoice from ${q.quote_no} for ${q.party}?`)) return;
    setBusy(true); setMsg('');
    try {
      await loadSellers();
      const s = sb();
      const { data: there, error: e0 } = await s.from('company_docs').select('doc_no').eq('company', co).eq('kind', 'invoice');
      if (e0) throw e0;
      const max = maxNo(there, 'doc_no');
      const docNo = co === 'ali-pack' ? (max ? `INV-${max + 1}` : 'INV-110001') : `INV-${CO_CODE[co] || 'X'}-${pad4(max + 1)}`;
      const row = {
        company: co, kind: 'invoice', doc_no: docNo, doc_date: todayISO(), party: q.party, party_details: q.party_details || null, party_vat: q.party_vat || null,
        items: (q.items || []).map((i) => ({ desc: i.desc, qty: num(i.qty), price: r3(i.price), amount: lineAmt(i) })),
        vat_pct: num(q.vat_pct), discount: -r3(q.discount), // invoices: a minus discount takes money off (lib/einvoice.js totalsOf)
        notes: [`From quotation ${q.quote_no}`, q.notes].filter(Boolean).join('\n'), created_by: me, updated_at: new Date().toISOString()
      };
      row.einv = { seller: (({ key, logo, ...x }) => ({ ...x, logo }))(sellerFor(co, null)), uuid: newUuid(), issued_at: new Date().toISOString(), type: '388', buyer_type: buyerType(row), standard: 'Fawtara PINT-OM (ready)' };
      const ins = await s.from('company_docs').insert(row).select('id, doc_no').single();
      if (ins.error) throw ins.error;
      const up = await s.from('quotations').update({ status: 'invoiced', invoice_id: ins.data.id, invoice_no: ins.data.doc_no, updated_at: new Date().toISOString() }).eq('id', q.id).select().single();
      if (up.error) throw up.error;
      if (q.contact_id) await s.from('crm_contacts').update({ stage: 'won', updated_at: new Date().toISOString() }).eq('id', q.contact_id);
      setMsg(`✓ Invoice ${ins.data.doc_no} made. Find it in Invoices.`);
      setView(up.data); load();
    } catch (err) { setMsg(err.message || String(err)); }
    setBusy(false);
  }

  async function remove(q) {
    if (!window.confirm(`Delete quote ${q.quote_no} (${q.party})?${q.invoice_no ? ` The invoice ${q.invoice_no} stays.` : ''}`)) return;
    withEditPassword(async () => {
      const { error } = await sb().from('quotations').delete().eq('id', q.id);
      if (error) setMsg(error.message); else { setMsg('✓ Deleted'); setView(null); load(); }
    });
  }

  async function pdf() {
    if (!paperRef.current) return;
    setBusy(true);
    try {
      const f = await paperPdf(paperRef.current, `${view.quote_no || 'quotation'}.pdf`);
      const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  }

  function whatsapp(q) {
    const t = quoteTotals(q);
    const c = contacts.find((x) => x.id === q.contact_id);
    const phone = String(c?.phone || '').replace(/[^\d]/g, '');
    const to = phone ? (phone.length === 8 ? `968${phone}` : phone) : '';
    const text = `Dear ${q.party}\n\nPlease find our quotation ${q.quote_no}\nTotal: OMR ${money(t.tot)} (VAT included)\nValid until: ${fmtDate(q.valid_until)}\n\n${C?.name || ''}`;
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(text)}`, '_blank');
  }

  const shown = useMemo(() => {
    const f = find.trim().toLowerCase();
    return (list || []).filter((q) => (!filter || q.status === filter) && (!f || `${q.quote_no} ${q.party} ${q.invoice_no || ''}`.toLowerCase().includes(f)));
  }, [list, filter, find]);
  const counts = useMemo(() => (list || []).reduce((m, q) => ({ ...m, [q.status]: (m[q.status] || 0) + 1 }), {}), [list]);
  const open = (list || []).filter((q) => q.status === 'sent' || q.status === 'draft');
  const openValue = r3(open.reduce((t, q) => t + quoteTotals(q).tot, 0));
  const won = (list || []).filter((q) => q.status === 'accepted' || q.status === 'invoiced');
  const decided = won.length + (counts.rejected || 0);

  if (pick.keys === null) return <p className="muted">Loading...</p>;
  const ft = form ? quoteTotals({ ...form, items: form.items }) : null;

  return (
    <>
      <div className="no-print">
        <h1>📝 Quotations{C ? ` · ${C.short}` : ''}</h1>
        <p className="sub">{C ? C.name : 'Choose a company'} · quotes for clients, print or PDF, then convert to an invoice</p>
        <CoBar pick={pick} />
      </div>

      {!co ? <p className="empty">Choose a company above.</p> : (
        <>
          {msg && <p className="muted qm-msg no-print">{msg}</p>}

          {form && (
            <form className="panel qm-form no-print" onSubmit={save}>
              <h3>{form.id ? `Edit ${form.quote_no}` : `＋ New quotation ${form.quote_no}`}</h3>
              <div className="qm-grid">
                <label className="qm-wide">Client<input list="qm-clients" value={form.party} onChange={(e) => pickParty(e.target.value)} placeholder="Company or person" required /></label>
                <datalist id="qm-clients">{contacts.map((c) => <option key={c.id} value={c.name} />)}</datalist>
                <label>Quote No.<input value={form.quote_no || ''} onChange={(e) => setF('quote_no', e.target.value)} /></label>
                <label>Date<input type="date" value={form.quote_date} onChange={(e) => setF('quote_date', e.target.value)} required /></label>
                <label>Valid until<input type="date" value={form.valid_until || ''} onChange={(e) => setF('valid_until', e.target.value)} /></label>
                <label>Client VAT No.<input value={form.party_vat || ''} onChange={(e) => setF('party_vat', e.target.value)} /></label>
                <label className="qm-wide">Client details (contact, phone, address)<textarea rows={2} value={form.party_details || ''} onChange={(e) => setF('party_details', e.target.value)} /></label>
              </div>
              {form.contact_id && <p className="muted qm-note">🤝 Linked to the customer in CRM</p>}

              <div className="table-wrap">
                <table className="qm-lines">
                  <thead><tr><th>#</th><th>Description</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Amount</th><th /></tr></thead>
                  <tbody>
                    {form.items.map((i, j) => (
                      <tr key={j}>
                        <td>{j + 1}</td>
                        <td><input value={i.desc} onChange={(e) => setLine(j, 'desc', e.target.value)} placeholder="Item or service" /></td>
                        <td className="num"><input inputMode="decimal" value={i.qty} onChange={(e) => setLine(j, 'qty', e.target.value.replace(/[^\d.]/g, ''))} /></td>
                        <td className="num"><input inputMode="decimal" value={i.price} onChange={(e) => setLine(j, 'price', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.000" /></td>
                        <td className="num">{money(lineAmt(i))}</td>
                        <td><button type="button" className="btn ghost" aria-label="Remove line" onClick={() => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, k) => k !== j) : [blankLine()] }))}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn ghost" onClick={() => setForm((f) => ({ ...f, items: [...f.items, blankLine()] }))}>＋ Add line</button>

              <div className="qm-grid qm-sums">
                <label>Discount (OMR)<input inputMode="decimal" value={form.discount} onChange={(e) => setF('discount', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.000" /></label>
                <label>VAT %<input inputMode="decimal" value={form.vat_pct} onChange={(e) => setF('vat_pct', e.target.value.replace(/[^\d.]/g, ''))} /></label>
                <div className="qm-total"><small>Subtotal {money(ft.items)}{ft.disc ? ` · Discount ${money(ft.disc)}` : ''} · VAT {money(ft.vat)}</small><b>Total OMR {money(ft.tot)}</b></div>
              </div>
              <div className="qm-grid">
                <label className="qm-wide">Notes (shown on the quote)<textarea rows={2} value={form.notes || ''} onChange={(e) => setF('notes', e.target.value)} /></label>
                <label className="qm-wide">Terms and conditions<textarea rows={3} value={form.terms || ''} onChange={(e) => setF('terms', e.target.value)} /></label>
              </div>
              <div className="qm-btns">
                <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving...' : '✓ Save'}</button>
                <button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
              </div>
            </form>
          )}

          {view && !form && (() => {
            const t = quoteTotals(view);
            const st = STATUS[view.status] || STATUS.draft;
            return (
              <>
                <div className="page-tools no-print"><div className="tools">
                  <button type="button" className="btn ghost" onClick={() => setView(null)}>‹ All quotes</button>
                  <button type="button" className="btn" onClick={() => window.print()}>🖨 Print</button>
                  <button type="button" className="btn" onClick={pdf} disabled={busy}>📕 PDF</button>
                  <button type="button" className="btn" onClick={() => whatsapp(view)}>📤 WhatsApp</button>
                  {canWrite && view.status !== 'invoiced' && <button type="button" className="btn ghost" onClick={() => editQuote(view)}>✏️ Edit</button>}
                  {canWrite && view.status === 'draft' && <button type="button" className="btn ghost" onClick={() => setStatus(view, 'sent')}>📨 Mark sent</button>}
                  {canWrite && ['draft', 'sent'].includes(view.status) && <button type="button" className="btn ghost" onClick={() => setStatus(view, 'accepted')}>✅ Accepted</button>}
                  {canWrite && ['draft', 'sent'].includes(view.status) && <button type="button" className="btn ghost" onClick={() => setStatus(view, 'rejected')}>✗ Rejected</button>}
                  {canWrite && view.status !== 'invoiced' && view.status !== 'rejected' && <button type="button" className="btn" onClick={() => toInvoice(view)} disabled={busy}>🧾 Convert to invoice</button>}
                  {view.invoice_no && <Link className="btn ghost" href={`/expenses/docs?co=${co}&kind=invoice`}>Open Invoices ({view.invoice_no})</Link>}
                  {user.canDelete && <button type="button" className="btn ghost" onClick={() => remove(view)}>🗑</button>}
                </div></div>
                <p className="no-print qm-state">Status: <span className={`pill ${st.cls}`}>{st.label}</span>{view.invoice_no ? <> · Invoice <b>{view.invoice_no}</b></> : null}</p>

                <article ref={paperRef} className="qm-paper">
                  <header className="qm-head">
                    {C?.logo ? <img src={C.logo} alt="" className="qm-logo" /> : <span />}
                    <div className="qm-co">
                      <b>{C?.name}</b>
                      {C?.cr && <span>{String(C.cr).startsWith('CR') ? C.cr : `CR No. ${C.cr}`}</span>}
                      {C?.address && <span>{C.address}</span>}
                    </div>
                  </header>
                  <h2 className="qm-title">QUOTATION <span lang="ar">عرض سعر</span></h2>
                  <div className="qm-meta">
                    <div><small>To</small><b>{view.party}</b>{view.party_details && <span className="qm-pre">{view.party_details}</span>}{view.party_vat && <span>VAT No. {view.party_vat}</span>}</div>
                    <div className="qm-meta-r">
                      <span><small>Quote No.</small> <b>{view.quote_no}</b></span>
                      <span><small>Date</small> {fmtDate(view.quote_date)}</span>
                      {view.valid_until && <span><small>Valid until</small> {fmtDate(view.valid_until)}</span>}
                    </div>
                  </div>
                  <table className="qm-t">
                    <thead><tr><th>#</th><th>Description</th><th className="num">Qty</th><th className="num">Unit price (OMR)</th><th className="num">Amount (OMR)</th></tr></thead>
                    <tbody>
                      {(view.items || []).map((i, j) => (
                        <tr key={j}><td>{j + 1}</td><td>{i.desc}</td><td className="num">{num(i.qty)}</td><td className="num">{money(i.price)}</td><td className="num">{money(lineAmt(i))}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <table className="qm-sum">
                    <tbody>
                      <tr><td>Subtotal</td><td className="num">{money(t.items)}</td></tr>
                      {t.disc > 0 && <tr><td>Discount</td><td className="num">- {money(t.disc)}</td></tr>}
                      <tr><td>VAT {num(view.vat_pct)}%</td><td className="num">{money(t.vat)}</td></tr>
                      <tr className="qm-grand"><td>Total (OMR)</td><td className="num">{money(t.tot)}</td></tr>
                    </tbody>
                  </table>
                  {view.notes && <p className="qm-pre qm-notes">{view.notes}</p>}
                  {view.terms && <div className="qm-terms"><b>Terms and conditions</b><p className="qm-pre">{view.terms}</p></div>}
                  <footer className="qm-sign">
                    <div><div className="qm-line" /><span>Authorised signature</span></div>
                    <div><div className="qm-line" /><span>Accepted by (client)</span></div>
                  </footer>
                </article>
              </>
            );
          })()}

          {!view && !form && (
            <div className="no-print">
              <div className="qm-boxes">
                <div className="panel"><small>Open quotes</small><b>{open.length}</b><span className="muted">OMR {money(openValue)}</span></div>
                <div className="panel"><small>Won</small><b>{won.length}</b><span className="muted">{decided ? `${Math.round((won.length / decided) * 100)}% of decided` : ' '}</span></div>
                <div className="panel"><small>Invoiced</small><b>{counts.invoiced || 0}</b><span className="muted"> </span></div>
              </div>
              <div className="page-tools"><div className="tools">
                {canWrite && <button type="button" className="btn" onClick={() => newQuote()}>＋ New quotation</button>}
                <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search client or number" aria-label="Search" />
                <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Status">
                  <option value="">All ({(list || []).length})</option>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label} ({counts[k] || 0})</option>)}
                </select>
                <Link href={`/expenses/crm?co=${co}`} className="btn ghost">🤝 Customers</Link>
              </div></div>
              {list === null ? <p className="muted">Loading...</p> : shown.length === 0 ? (
                <p className="empty">{(list || []).length ? 'No quotes match.' : 'No quotations yet. Press ＋ New quotation.'}</p>
              ) : (
                <div className="table-wrap"><table>
                  <thead><tr><th>No.</th><th>Date</th><th>Client</th><th className="num">Total (OMR)</th><th>Valid until</th><th>Status</th></tr></thead>
                  <tbody>
                    {shown.map((q) => {
                      const st = STATUS[q.status] || STATUS.draft;
                      const late = ['draft', 'sent'].includes(q.status) && q.valid_until && q.valid_until < todayISO();
                      return (
                        <tr key={q.id} className="qm-row" onClick={() => setView(q)}>
                          <td><button type="button" className="linklike">{q.quote_no}</button></td>
                          <td>{fmtDate(q.quote_date)}</td>
                          <td>{q.party}</td>
                          <td className="num">{money(quoteTotals(q).tot)}</td>
                          <td className={late ? 'qm-late' : ''}>{fmtDate(q.valid_until)}{late ? ' · expired' : ''}</td>
                          <td><span className={`pill ${st.cls}`}>{st.label}</span>{q.invoice_no ? <small className="muted"> {q.invoice_no}</small> : null}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              )}
              {C && <p style={{ marginTop: 14 }}><Link href={`/company/${C.key}`}>‹ Back to {C.short}</Link></p>}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function Page() {
  return <AuthGate><Quotes /></AuthGate>;
}
