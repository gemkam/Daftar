'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import CoBar from '@/components/CoBar';
import { sb, fmtDate } from '@/lib/supabase';
import { useCoPick, money, r3, todayISO, addDays } from '@/lib/coPick';
import { withEditPassword } from '@/lib/editLock';

/*
  🤝 Customers (CRM) (27 Nov 2026, Kamran). Table crm_contacts (database/12_crm_quotes_leave.sql).
  - Pipeline: Lead › Contacted › Quoted › Won / Lost, with the expected value of each stage.
  - Next follow-up date: "Follow up today" list on top (late ones in red).
  - 📞 Call and 💬 WhatsApp buttons, quick notes log (who, when, what).
  - ＋ Quote opens Quotations with this customer filled in. A quote moves him to Quoted,
    Accepted or Convert to invoice moves him to Won, Rejected moves him to Lost (app/expenses/quotes/page.js).
*/

const STAGES = [
  ['lead', 'Lead', '🌱'],
  ['contacted', 'Contacted', '📞'],
  ['quoted', 'Quoted', '📝'],
  ['won', 'Won', '🏆'],
  ['lost', 'Lost', '✗']
];
const STAGE = Object.fromEntries(STAGES.map(([k, l, i]) => [k, { label: l, ico: i }]));
const SOURCES = ['Walk-in', 'Referral', 'WhatsApp', 'Instagram', 'Facebook', 'Website', 'Phone call', 'Exhibition', 'Other'];
const blank = () => ({ id: null, name: '', contact_person: '', phone: '', email: '', address: '', vat_no: '', stage: 'lead', source: '', value: '', next_follow_up: addDays(todayISO(), 2), owner: '', notes: '' });
const waNo = (p) => { const d = String(p || '').replace(/[^\d]/g, ''); return d.length === 8 ? `968${d}` : d; };

function Crm() {
  const user = useUser();
  const me = user.name || user.username;
  const pick = useCoPick(user, '/expenses/crm');
  const { co, company: C } = pick;
  const [list, setList] = useState(null);
  const [stage, setStage] = useState('open'); // open = everything not won / lost
  const [find, setFind] = useState('');
  const [form, setForm] = useState(null);
  const [noteFor, setNoteFor] = useState(null); // { id, text }
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const canWrite = !!user.isAdmin;
  const today = todayISO();

  async function load() {
    if (!co) return;
    const { data, error } = await sb().from('crm_contacts').select('*').eq('company', co).order('updated_at', { ascending: false });
    if (error) { setMsg(/crm_contacts|does not exist|schema cache/i.test(error.message) ? 'The CRM table is not in the database yet. Run database/12_crm_quotes_leave.sql in Supabase.' : error.message); setList([]); return; }
    setList(data || []);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setList(null); setForm(null); load(); }, [co]);

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) { setMsg('Type the customer name.'); return; }
    setBusy(true); setMsg('');
    const row = {
      company: co, name: form.name.trim(), contact_person: form.contact_person || null, phone: form.phone || null, email: form.email || null,
      address: form.address || null, vat_no: form.vat_no || null, stage: form.stage, source: form.source || null, value: r3(form.value),
      next_follow_up: form.next_follow_up || null, owner: form.owner || null, notes: form.notes || null, updated_at: new Date().toISOString()
    };
    const s = sb().from('crm_contacts');
    const { error } = form.id ? await s.update(row).eq('id', form.id) : await s.insert({ ...row, created_by: me, log: [{ at: new Date().toISOString(), by: me, text: 'Customer added' }] });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setForm(null); setMsg(form.id ? '✓ Saved' : '✓ Customer added');
    load();
  }

  async function patch(c, change, logText) {
    const log = logText ? [{ at: new Date().toISOString(), by: me, text: logText }, ...(c.log || [])].slice(0, 100) : c.log;
    const { error } = await sb().from('crm_contacts').update({ ...change, log, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (error) { setMsg(error.message); return false; }
    load();
    return true;
  }

  const moveStage = (c, s) => patch(c, { stage: s, ...(s === 'won' || s === 'lost' ? { next_follow_up: null } : {}) }, `Stage: ${STAGE[c.stage]?.label} › ${STAGE[s].label}`);
  const followDone = (c, days) => patch(c, { next_follow_up: days ? addDays(today, days) : null }, days ? `Followed up, next in ${days} days` : 'Followed up, no next date');

  async function addNote(e) {
    e.preventDefault();
    const c = (list || []).find((x) => x.id === noteFor.id);
    if (!c || !noteFor.text.trim()) return;
    if (await patch(c, {}, noteFor.text.trim())) setNoteFor(null);
  }

  async function remove(c) {
    if (!window.confirm(`Delete customer ${c.name}? His quotes stay.`)) return;
    withEditPassword(async () => {
      const { error } = await sb().from('crm_contacts').delete().eq('id', c.id);
      if (error) setMsg(error.message); else { setMsg('✓ Deleted'); load(); }
    });
  }

  const due = useMemo(() => (list || []).filter((c) => c.next_follow_up && c.next_follow_up <= today && !['won', 'lost'].includes(c.stage))
    .sort((a, b) => a.next_follow_up.localeCompare(b.next_follow_up)), [list, today]);
  const byStage = useMemo(() => STAGES.map(([k]) => {
    const rs = (list || []).filter((c) => c.stage === k);
    return { key: k, n: rs.length, value: r3(rs.reduce((t, c) => t + Number(c.value || 0), 0)) };
  }), [list]);
  const shown = useMemo(() => {
    const f = find.trim().toLowerCase();
    return (list || []).filter((c) => (stage === 'all' || (stage === 'open' ? !['won', 'lost'].includes(c.stage) : c.stage === stage))
      && (!f || `${c.name} ${c.contact_person || ''} ${c.phone || ''} ${c.email || ''}`.toLowerCase().includes(f)));
  }, [list, stage, find]);
  const pipeValue = r3(byStage.filter((s) => !['won', 'lost'].includes(s.key)).reduce((t, s) => t + s.value, 0));

  if (pick.keys === null) return <p className="muted">Loading...</p>;

  const card = (c) => {
    const late = c.next_follow_up && c.next_follow_up < today;
    const isOpen = openId === c.id;
    return (
      <div key={c.id} className={`panel qm-card st-${c.stage}`}>
        <div className="qm-card-top">
          <button type="button" className="linklike qm-card-name" onClick={() => setOpenId(isOpen ? null : c.id)}><b>{c.name}</b></button>
          <span className="pill neutral">{STAGE[c.stage]?.ico} {STAGE[c.stage]?.label}</span>
        </div>
        <div className="qm-card-sub">
          {c.contact_person && <span>👤 {c.contact_person}</span>}
          {Number(c.value) > 0 && <span>💰 OMR {money(c.value)}</span>}
          {c.next_follow_up && <span className={late ? 'qm-late' : c.next_follow_up === today ? 'qm-today' : ''}>⏰ {c.next_follow_up === today ? 'Today' : fmtDate(c.next_follow_up)}{late ? ' (late)' : ''}</span>}
          {c.source && <span className="muted">{c.source}</span>}
        </div>
        <div className="qm-card-btns">
          {c.phone && <a className="btn ghost" href={`tel:${c.phone}`}>📞 Call</a>}
          {c.phone && <a className="btn ghost" href={`https://wa.me/${waNo(c.phone)}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>}
          {canWrite && <Link className="btn ghost" href={`/expenses/quotes?co=${co}&new=${c.id}`}>＋ Quote</Link>}
          {canWrite && !['won', 'lost'].includes(c.stage) && <button type="button" className="btn ghost" onClick={() => followDone(c, 3)}>✓ Followed up</button>}
          {canWrite && (
            <select value={c.stage} onChange={(e) => moveStage(c, e.target.value)} aria-label="Stage">
              {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          )}
        </div>
        {isOpen && (
          <div className="qm-card-more">
            {c.phone && <p>📱 {c.phone}</p>}
            {c.email && <p>✉️ <a href={`mailto:${c.email}`}>{c.email}</a></p>}
            {c.address && <p>📍 {c.address}</p>}
            {c.vat_no && <p>VAT No. {c.vat_no}</p>}
            {c.owner && <p>Handled by {c.owner}</p>}
            {c.notes && <p className="qm-pre">{c.notes}</p>}
            {canWrite && (noteFor?.id === c.id ? (
              <form className="qm-note-form" onSubmit={addNote}>
                <input autoFocus value={noteFor.text} onChange={(e) => setNoteFor({ ...noteFor, text: e.target.value })} placeholder="What happened? e.g. Called, wants price for 10 units" />
                <button type="submit" className="btn">Add</button>
                <button type="button" className="btn ghost" onClick={() => setNoteFor(null)}>Cancel</button>
              </form>
            ) : <button type="button" className="btn ghost" onClick={() => setNoteFor({ id: c.id, text: '' })}>📝 Add note</button>)}
            <ul className="qm-log">
              {(c.log || []).map((l, i) => <li key={i}><small className="muted">{fmtDate(l.at)} · {l.by}</small> {l.text}</li>)}
            </ul>
            <div className="qm-card-btns">
              {canWrite && <button type="button" className="btn ghost" onClick={() => withEditPassword(() => setForm({ ...blank(), ...c, value: c.value ? String(c.value) : '' }))}>✏️ Edit</button>}
              <Link className="btn ghost" href={`/expenses/quotes?co=${co}`}>📝 Quotes</Link>
              {user.canDelete && <button type="button" className="btn ghost" onClick={() => remove(c)}>🗑 Delete</button>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <h1>🤝 Customers{C ? ` · ${C.short}` : ''}</h1>
      <p className="sub">{C ? C.name : 'Choose a company'} · leads, follow-ups and the sales pipeline</p>
      <CoBar pick={pick} />

      {!co ? <p className="empty">Choose a company above.</p> : (
        <>
          {msg && <p className="muted qm-msg">{msg}</p>}
          <div className="page-tools"><div className="tools">
            {canWrite && <button type="button" className="btn" onClick={() => withEditPassword(() => setForm(blank()))}>＋ New customer</button>}
            <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search name or phone" aria-label="Search" />
            <Link href={`/expenses/quotes?co=${co}`} className="btn ghost">📝 Quotations</Link>
          </div></div>

          {form && (
            <form className="panel qm-form" onSubmit={save}>
              <h3>{form.id ? `Edit ${form.name}` : '＋ New customer'}</h3>
              <div className="qm-grid">
                <label className="qm-wide">Customer / company name<input value={form.name} onChange={(e) => setF('name', e.target.value)} required /></label>
                <label>Contact person<input value={form.contact_person || ''} onChange={(e) => setF('contact_person', e.target.value)} /></label>
                <label>Phone / WhatsApp<input inputMode="tel" value={form.phone || ''} onChange={(e) => setF('phone', e.target.value)} placeholder="9xxxxxxx" /></label>
                <label>Email<input type="email" value={form.email || ''} onChange={(e) => setF('email', e.target.value)} /></label>
                <label>VAT No.<input value={form.vat_no || ''} onChange={(e) => setF('vat_no', e.target.value)} /></label>
                <label className="qm-wide">Address<input value={form.address || ''} onChange={(e) => setF('address', e.target.value)} /></label>
                <label>Stage<select value={form.stage} onChange={(e) => setF('stage', e.target.value)}>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                <label>Source<input list="qm-src" value={form.source || ''} onChange={(e) => setF('source', e.target.value)} /></label>
                <datalist id="qm-src">{SOURCES.map((x) => <option key={x} value={x} />)}</datalist>
                <label>Expected value (OMR)<input inputMode="decimal" value={form.value} onChange={(e) => setF('value', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.000" /></label>
                <label>Next follow-up<input type="date" value={form.next_follow_up || ''} onChange={(e) => setF('next_follow_up', e.target.value)} /></label>
                <label>Handled by<input value={form.owner || ''} onChange={(e) => setF('owner', e.target.value)} placeholder={me} /></label>
                <label className="qm-wide">Notes<textarea rows={2} value={form.notes || ''} onChange={(e) => setF('notes', e.target.value)} /></label>
              </div>
              <div className="qm-btns">
                <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving...' : '✓ Save'}</button>
                <button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
              </div>
            </form>
          )}

          <div className="qm-pipe" role="tablist" aria-label="Stage">
            <button type="button" className={stage === 'open' ? 'on' : ''} onClick={() => setStage('open')}><small>Open pipeline</small><b>{(list || []).filter((c) => !['won', 'lost'].includes(c.stage)).length}</b><span>OMR {money(pipeValue)}</span></button>
            {byStage.map((s) => (
              <button key={s.key} type="button" className={stage === s.key ? 'on' : ''} onClick={() => setStage(s.key)}>
                <small>{STAGE[s.key].ico} {STAGE[s.key].label}</small><b>{s.n}</b><span>OMR {money(s.value)}</span>
              </button>
            ))}
            <button type="button" className={stage === 'all' ? 'on' : ''} onClick={() => setStage('all')}><small>All</small><b>{(list || []).length}</b><span> </span></button>
          </div>

          {due.length > 0 && (
            <section className="panel qm-due">
              <h2>⏰ Follow up today ({due.length})</h2>
              <ul>
                {due.map((c) => (
                  <li key={c.id}>
                    <b>{c.name}</b>{c.contact_person ? ` · ${c.contact_person}` : ''}
                    <span className={c.next_follow_up < today ? 'qm-late' : 'qm-today'}> {c.next_follow_up < today ? `late since ${fmtDate(c.next_follow_up)}` : 'today'}</span>
                    <span className="qm-due-btns">
                      {c.phone && <a className="btn ghost" href={`https://wa.me/${waNo(c.phone)}`} target="_blank" rel="noreferrer">💬</a>}
                      {c.phone && <a className="btn ghost" href={`tel:${c.phone}`}>📞</a>}
                      {canWrite && <button type="button" className="btn ghost" onClick={() => followDone(c, 3)}>✓ Done, +3 days</button>}
                      {canWrite && <button type="button" className="btn ghost" onClick={() => followDone(c, 7)}>+7 days</button>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {list === null ? <p className="muted">Loading...</p> : shown.length === 0 ? (
            <p className="empty">{(list || []).length ? 'No customers here.' : 'No customers yet. Press ＋ New customer to add your first lead.'}</p>
          ) : (
            <div className="qm-cards">{shown.map((c) => card(c))}</div>
          )}
          {C && <p style={{ marginTop: 14 }}><Link href={`/company/${C.key}`}>‹ Back to {C.short}</Link></p>}
        </>
      )}
    </>
  );
}

export default function Page() {
  return <AuthGate><Crm /></AuthGate>;
}
