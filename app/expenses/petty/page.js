'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import CompanyLock from '@/components/CompanyLock';
import { sb, fmtDate } from '@/lib/supabase';
import { COMPANIES, CATEGORIES } from '@/lib/expenses';
import { myCompanyKeys, isCompanyUnlocked, unlockCompany } from '@/lib/companyAccess';
import { withEditPassword } from '@/lib/editLock';
import { exportExcel } from '@/lib/sheet';
import { canSeeFaisal } from '@/lib/faisal';

/*
  💵 Petty cash (11 Nov 2026, Owner): one petty cash book for every company (the 3 + every added company,
  so future companies get it too). Table petty_cash (supabase/petty-cash.sql).
  - ＋ Cash received (top-up) / ＋ Spent; month view with Opening balance, Received, Spent, Closing balance,
    running balance per row; Edit / Delete; 🖨 Print; 📗 Excel.
  - Company switch on top changes the data. Each company asks its password once (same as All Companies).
  - 📊 All companies (Faisal and Administrators): every company together with a Company column, and totals by company.
*/
const r3 = (n) => Math.round(Number(n || 0) * 1000) / 1000;
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const today = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);
const monthEnd = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
const monthName = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const short = (k) => COMPANIES.find((c) => c.key === k)?.short || k;
const blank = (co) => ({ id: null, company: co, date: today(), kind: 'out', voucher: '', description: '', party: '', category: '', amount: '', note: '' });

function PettyCash() {
  const user = useUser();
  const all = canSeeFaisal(user);
  const [keys, setKeys] = useState(null);
  const [co, setCo] = useState('');
  const [ask, setAsk] = useState(null);
  const [month, setMonth] = useState(thisMonth());
  const [rows, setRows] = useState(null);
  const [opening, setOpening] = useState({});
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { myCompanyKeys(user).then(setKeys).catch(() => setKeys([])); }, [user]);
  const list = keys === 'all' ? COMPANIES : COMPANIES.filter((c) => (keys || []).includes(c.key));

  useEffect(() => {
    let k = '';
    try { k = new URLSearchParams(window.location.search).get('co') || ''; } catch { /* ignore */ }
    if (k === 'all' && all) setCo('all');
    else if (COMPANIES.some((c) => c.key === k)) choose(k);
    else if (all) setCo('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  function choose(k) {
    if (k !== 'all' && !isCompanyUnlocked(k)) { setAsk(COMPANIES.find((c) => c.key === k) || null); return; }
    setCo(k); setForm(null);
    try { window.history.replaceState(null, '', `/expenses/petty?co=${k}`); } catch { /* ignore */ }
  }

  const cos = co === 'all' ? list.map((c) => c.key) : co ? [co] : [];

  async function load() {
    if (!cos.length) { setRows([]); setOpening({}); return; }
    setRows(null);
    const from = `${month}-01`;
    const to = monthEnd(month);
    const s = sb();
    const [cur, before] = await Promise.all([
      s.from('petty_cash').select('*').in('company', cos).gte('date', from).lte('date', to).order('date').order('created_at'),
      s.from('petty_cash').select('company, kind, amount').in('company', cos).lt('date', from)
    ]);
    if (cur.error || before.error) { setMsg((cur.error || before.error).message); setRows([]); return; }
    const op = {};
    (before.data || []).forEach((r) => { op[r.company] = r3((op[r.company] || 0) + (r.kind === 'in' ? 1 : -1) * Number(r.amount)); });
    setOpening(op);
    setRows(cur.data || []);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [co, month, keys]);

  // running balance per company, in date order
  const shown = useMemo(() => {
    const bal = { ...opening };
    return (rows || []).map((r) => {
      bal[r.company] = r3((bal[r.company] || 0) + (r.kind === 'in' ? 1 : -1) * Number(r.amount));
      return { ...r, balance: bal[r.company] };
    });
  }, [rows, opening]);

  const byCo = useMemo(() => cos.map((k) => {
    const rs = (rows || []).filter((r) => r.company === k);
    const inn = r3(rs.filter((r) => r.kind === 'in').reduce((a, r) => a + Number(r.amount), 0));
    const out = r3(rs.filter((r) => r.kind === 'out').reduce((a, r) => a + Number(r.amount), 0));
    const op = opening[k] || 0;
    return { key: k, op, inn, out, close: r3(op + inn - out) };
  }), [rows, opening, cos.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const tot = byCo.reduce((a, b) => ({ op: r3(a.op + b.op), inn: r3(a.inn + b.inn), out: r3(a.out + b.out), close: r3(a.close + b.close) }), { op: 0, inn: 0, out: 0, close: 0 });

  function openForm(kind, row) {
    withEditPassword(() => setForm(row ? { ...row, amount: String(row.amount) } : { ...blank(co === 'all' ? (list[0]?.key || '') : co), kind }));
  }

  async function save(e) {
    e.preventDefault();
    const amt = r3(form.amount);
    if (!form.company) { setMsg('Choose the company.'); return; }
    if (!(amt > 0)) { setMsg('Type the amount.'); return; }
    setBusy(true); setMsg('');
    const row = { company: form.company, date: form.date || today(), kind: form.kind, voucher: form.voucher || null, description: form.description || null, party: form.party || null, category: form.category || null, amount: amt, note: form.note || null, updated_at: new Date().toISOString() };
    const s = sb().from('petty_cash');
    const { error } = form.id ? await s.update(row).eq('id', form.id) : await s.insert({ ...row, created_by: user.name || user.username });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setForm(null); setMsg(form.id ? '✓ Saved' : '✓ Added');
    if (row.date.slice(0, 7) !== month) setMonth(row.date.slice(0, 7)); else load();
  }

  async function remove(r) {
    if (!window.confirm(`Delete this petty cash line (${r.kind === 'in' ? 'received' : 'spent'} OMR ${money(r.amount)})?`)) return;
    withEditPassword(async () => {
      const { error } = await sb().from('petty_cash').delete().eq('id', r.id);
      if (error) setMsg(error.message); else { setMsg('✓ Deleted'); load(); }
    });
  }

  function excel() {
    const head = [...(co === 'all' ? ['Company'] : []), 'Date', 'Voucher No.', 'Description', 'Paid to / Received from', 'Category', 'Received', 'Spent', 'Balance'];
    const n = co === 'all' ? 1 : 0;
    exportExcel(`Petty cash ${co === 'all' ? 'All companies' : short(co)} ${month}.xlsx`, [{
      name: 'Petty cash', title: `Petty cash · ${co === 'all' ? 'All companies' : COMPANIES.find((c) => c.key === co)?.name || short(co)}`,
      subtitle: `${monthName(month)} · Opening ${money(tot.op)} · Received ${money(tot.inn)} · Spent ${money(tot.out)} · Closing ${money(tot.close)}`,
      head, numCols: [n + 5, n + 6, n + 7], widths: [...(co === 'all' ? [16] : []), 12, 12, 34, 24, 16, 12, 12, 12],
      rows: shown.map((r) => [...(co === 'all' ? [short(r.company)] : []), r.date, r.voucher || '', r.description || '', r.party || '', r.category || '', r.kind === 'in' ? Number(r.amount) : '', r.kind === 'out' ? Number(r.amount) : '', r.balance]),
      totalsRow: [...(co === 'all' ? [''] : []), 'Total', '', '', '', '', tot.inn, tot.out, tot.close]
    }]);
  }

  if (keys === null) return <p className="muted">Loading...</p>;
  const c = COMPANIES.find((x) => x.key === co);
  const canWrite = !!user.isAdmin;

  return (
    <>
      <h1>💵 Petty cash{co === 'all' ? ' · All companies' : c ? ` · ${c.short}` : ''}</h1>
      <p className="sub">{c ? c.name : co === 'all' ? 'Every company together' : 'Choose a company'} · cash received and cash spent, with the balance</p>

      <div className="co-switch pc-switch no-print" role="tablist" aria-label="Company">
        {all && <button type="button" className={co === 'all' ? 'on' : ''} onClick={() => choose('all')}>📊 All companies</button>}
        {list.map((x) => <button key={x.key} type="button" className={co === x.key ? 'on' : ''} onClick={() => choose(x.key)}>{x.short}{!isCompanyUnlocked(x.key) ? ' 🔒' : ''}</button>)}
      </div>
      {ask && <CompanyLock company={ask} onCancel={() => setAsk(null)} onOpen={() => { unlockCompany(ask.key); const k = ask.key; setAsk(null); choose(k); }} />}

      {!co ? <p className="empty">Choose a company above.</p> : (
        <>
          <div className="page-tools no-print"><div className="tools">
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" />
            {canWrite && <button type="button" className="btn" onClick={() => openForm('in')}>＋ Cash received</button>}
            {canWrite && <button type="button" className="btn" onClick={() => openForm('out')}>＋ Spent</button>}
            <button type="button" className="btn" onClick={() => window.print()}>🖨 Print</button>
            <button type="button" className="btn" onClick={excel}>📗 Excel</button>
          </div></div>
          {msg && <p className="muted pc-msg">{msg}</p>}

          {form && (
            <form className="card pc-form no-print" onSubmit={save}>
              <h3>{form.id ? 'Edit line' : form.kind === 'in' ? '＋ Cash received into petty cash' : '＋ Spent from petty cash'}</h3>
              <div className="pc-grid">
                {co === 'all' && <label>Company<select value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>{list.map((x) => <option key={x.key} value={x.key}>{x.short}</option>)}</select></label>}
                <label>Type<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="in">Cash received</option><option value="out">Spent</option></select></label>
                <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
                <label>Amount (OMR)<input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, '') })} required /></label>
                <label>Voucher No.<input value={form.voucher || ''} onChange={(e) => setForm({ ...form, voucher: e.target.value })} /></label>
                <label className="pc-wide">Description<input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                <label>{form.kind === 'in' ? 'Received from' : 'Paid to'}<input value={form.party || ''} onChange={(e) => setForm({ ...form, party: e.target.value })} /></label>
                <label>Category<input list="pc-cats" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
                <label className="pc-wide">Note<input value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
              </div>
              <datalist id="pc-cats">{CATEGORIES.map((x) => <option key={x} value={x} />)}</datalist>
              <div className="pc-btns">
                <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving...' : '✓ Save'}</button>
                <button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
              </div>
            </form>
          )}

          <h2 className="print-only">Petty cash · {co === 'all' ? 'All companies' : c?.name} · {monthName(month)}</h2>
          <div className="pc-boxes">
            <div className="card"><small>Opening balance</small><b>OMR {money(tot.op)}</b></div>
            <div className="card"><small>Cash received</small><b className="pc-in">OMR {money(tot.inn)}</b></div>
            <div className="card"><small>Spent</small><b className="pc-out">OMR {money(tot.out)}</b></div>
            <div className="card"><small>Closing balance</small><b className={tot.close < 0 ? 'pc-out' : ''}>OMR {money(tot.close)}</b></div>
          </div>

          {co === 'all' && (
            <div className="table-wrap"><table className="pc-table">
              <thead><tr><th>Company</th><th>Opening</th><th>Received</th><th>Spent</th><th>Closing</th></tr></thead>
              <tbody>
                {byCo.map((b) => (
                  <tr key={b.key}><td><button type="button" className="linklike" onClick={() => choose(b.key)}>{short(b.key)}</button></td><td className="num">{money(b.op)}</td><td className="num">{money(b.inn)}</td><td className="num">{money(b.out)}</td><td className="num"><b>{money(b.close)}</b></td></tr>
                ))}
              </tbody>
              <tfoot><tr><th>Total</th><th className="num">{money(tot.op)}</th><th className="num">{money(tot.inn)}</th><th className="num">{money(tot.out)}</th><th className="num">{money(tot.close)}</th></tr></tfoot>
            </table></div>
          )}

          {rows === null ? <p className="muted">Loading...</p> : shown.length === 0 ? <p className="empty">No petty cash lines in {monthName(month)}.</p> : (
            <div className="table-wrap"><table className="pc-table">
              <thead><tr>{co === 'all' && <th>Company</th>}<th>Date</th><th>Voucher No.</th><th>Description</th><th>Paid to / Received from</th><th>Category</th><th>Received</th><th>Spent</th><th>Balance</th><th className="no-print">By</th>{canWrite && <th className="no-print" />}</tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    {co === 'all' && <td>{short(r.company)}</td>}
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.voucher}</td>
                    <td>{r.description}{r.note ? <small className="muted"> · {r.note}</small> : null}</td>
                    <td>{r.party}</td>
                    <td>{r.category}</td>
                    <td className="num pc-in">{r.kind === 'in' ? money(r.amount) : ''}</td>
                    <td className="num pc-out">{r.kind === 'out' ? money(r.amount) : ''}</td>
                    <td className="num"><b>{money(r.balance)}</b></td>
                    <td className="no-print"><small>{r.created_by}</small></td>
                    {canWrite && <td className="no-print pc-act"><button type="button" className="btn ghost" onClick={() => openForm(r.kind, r)}>✏️</button>{user.canDelete && <button type="button" className="btn ghost" onClick={() => remove(r)}>🗑</button>}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot><tr>{co === 'all' && <th />}<th colSpan={5}>Total {monthName(month)}</th><th className="num">{money(tot.inn)}</th><th className="num">{money(tot.out)}</th><th className="num">{money(tot.close)}</th><th className="no-print" />{canWrite && <th className="no-print" />}</tr></tfoot>
            </table></div>
          )}
          {c && <p className="no-print" style={{ marginTop: 14 }}><Link href={`/company/${c.key}`}>‹ Back to {c.short}</Link></p>}
        </>
      )}
    </>
  );
}

export default function Page() {
  return <AuthGate><PettyCash /></AuthGate>;
}
