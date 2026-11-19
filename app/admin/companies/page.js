'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGate, { useUser, ROLES } from '@/components/AuthGate';
import Modal from '@/components/Modal';
import AddCompany from '@/components/AddCompany';
import { sb } from '@/lib/supabase';
import { COMPANIES } from '@/lib/expenses';
import { loadAllAccess, setAccess, lockCompany, ALL_CO } from '@/lib/companyAccess';
import { loadSellers, sellerExtra, saveSellerExtra } from '@/lib/einvoice';

/*
  Admin › 🏢 Company access (/admin/companies, Owner 9 Nov 2026). Administrator only.
  1. Companies: every company with its buttons: Open, ✏️ Edit details (added companies), 🧾 E-invoice details (VAT No. + Arabic name, every company), ⬇ Backup (JSON of all its data),
     🗑 Delete data (backup downloads first, type the company name + password), ✖ Remove company (added companies only),
     ＋ Add company.
  2. Users and their companies: tick which user may open which company (table company_access).
  DB: RPC admin_company_data(company, mode count|backup|delete|remove) (supabase/company-admin.sql).
  Delete / Remove: confirm by typing the signed-in user's own username (no password, Owner 9 Nov 2026).
  Delete data removes: bills / invoices, typed expense lines, staff, attendance, salary slips and credits, subcontractors,
  bank accounts and lines, assets / loans, budgets. NOT Transport (trip sheets, drivers, vehicles) or the Transport
  auto lines in Al Noor. Every deleted row is still kept in the audit log.
*/

const LABELS = {
  bills_invoices: 'Bills and invoices', expense_lines: 'Expense lines', auto_transport_lines: 'Transport auto lines (kept)',
  staff: 'Employees', attendance: 'Attendance marks', salary_slips: 'Salary slips', salary_credits: 'Salary paid marks',
  subcontractors: 'Subcontractors', bank_accounts: 'Bank / cash accounts', bank_lines: 'Bank lines',
  assets_loans: 'Assets, loans, capital', budgets: 'Budgets', user_access: 'Users with access'
};
const FIXED = ['al-noor', 'sahil'];

function download(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

async function backupOf(key) {
  const { data, error } = await sb().rpc('admin_company_data', { p_company: key, p_mode: 'backup' });
  if (error) throw error;
  download(`backup-${key}-${stamp()}.json`, data);
}

/* 🗑 Delete data / ✖ Remove company: counts, automatic backup, type name + password */
function DangerBox({ c, mode, me, onClose, onDone, flash }) {
  const [counts, setCounts] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    sb().rpc('admin_company_data', { p_company: c.key, p_mode: 'count' }).then(({ data, error }) => {
      if (error) setErr(error.message); else setCounts(data || {});
    });
  }, [c.key]);
  async function go(e) {
    e.preventDefault();
    setErr('');
    // 9 Nov 2026 (Owner): confirm with the signed-in user's OWN username and login password
    const u = name.trim().toLowerCase().replace(/@daftar\.local$/, '');
    if (u !== String(me.username || '').toLowerCase()) { setErr(`Type your own username (you are signed in as ${me.username}).`); return; }
    setBusy(true); // 9 Nov 2026 (Owner): only the username, no password
    try {
      await backupOf(c.key); // always keep a copy first
      const { error } = await sb().rpc('admin_company_data', { p_company: c.key, p_mode: mode });
      if (error) throw error;
      lockCompany(c.key);
      if (mode === 'remove') {
        const i = COMPANIES.findIndex((x) => x.key === c.key);
        if (i >= 0) COMPANIES.splice(i, 1);
      }
      flash(mode === 'remove' ? `${c.short} removed. Backup downloaded.` : `${c.short}: data deleted. Backup downloaded.`);
      onDone();
    } catch (x) { setErr(x.message); setBusy(false); }
  }
  const title = mode === 'remove' ? `✖ Remove company · ${c.short}` : `🗑 Delete all data · ${c.short}`;
  return (
    <Modal title={title} onClose={() => !busy && onClose()}>
      <form onSubmit={go} className="cp-form">
        <p style={{ margin: 0 }}>{mode === 'remove'
          ? <>This deletes <b>all data of {c.short}</b> and removes the company and its user access.</>
          : <>This deletes <b>all data of {c.short}</b>. The company and its button stay, empty.</>}
        {' '}A backup file downloads first. Transport (trip sheets, drivers, vehicles) is not touched.</p>
        {!counts ? <p className="muted">Counting...</p> : (
          <table className="adm-acc ca-counts"><tbody>
            {Object.entries(LABELS).map(([k, l]) => (counts[k] ? <tr key={k}><td>{l}</td><td className="num"><b>{counts[k]}</b></td></tr> : null))}
            {!Object.keys(LABELS).some((k) => counts[k]) && <tr><td colSpan={2} className="muted">No data saved for this company.</td></tr>}
          </tbody></table>
        )}
        <p className="muted" style={{ margin: 0 }}>To confirm, type <b>your own username</b> (you are signed in as <b>{me.username}</b>).</p>
        <label><span>Your username</span><input className="drv-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" autoCapitalize="none" /></label>
        {err && <div className="error">{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn danger" disabled={busy || !counts}>{busy ? 'Working...' : mode === 'remove' ? 'Remove company' : 'Delete data'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ✏️ Edit details of an added company (the 3 main companies are fixed in the app) */
function EditBox({ c, onClose, onDone, flash }) {
  const [f, setF] = useState({ short: c.short, name: c.name, cr: String(c.cr || '').replace(/^CR:\s*/i, ''), address: c.address || '' });
  const [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    if (!f.short.trim()) { flash('Type the company name', 'err'); return; }
    setBusy(true);
    const row = { short: f.short.trim(), name: f.name.trim() || f.short.trim().toUpperCase(), cr: f.cr.trim() || null, address: f.address.trim() || null };
    const { error } = await sb().from('personnel_companies').update(row).eq('key', c.key);
    setBusy(false);
    if (error) { flash(error.message, 'err'); return; }
    Object.assign(c, { short: row.short, name: row.name, cr: row.cr ? `CR: ${row.cr}` : '', address: row.address || '' });
    flash('Company details saved');
    onDone();
  }
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal title={`✏️ Edit · ${c.short}`} onClose={onClose}>
      <form onSubmit={save} className="cp-form">
        <label><span>Short name (button)</span><input className="drv-input" value={f.short} onChange={set('short')} /></label>
        <label><span>Full name</span><input className="drv-input" value={f.name} onChange={set('name')} /></label>
        <label><span>CR No.</span><input className="drv-input" value={f.cr} onChange={set('cr')} /></label>
        <label><span>Address</span><input className="drv-input" value={f.address} onChange={set('address')} /></label>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn in" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* 🧾 E-invoice details: VAT No. and Arabic name printed on the company's invoices (every company) */
function EinvBox({ c, onClose, flash }) {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadSellers(true).then(() => { const e = sellerExtra(c.key); setF({ vat: e.vat || '', name_ar: e.name_ar || '' }); }); }, [c.key]);
  async function save(e) {
    e.preventDefault();
    const vat = f.vat.trim().toUpperCase().replace(/\s+/g, '');
    if (vat && !/^OM\d{10}$/.test(vat)) { flash('VAT No. should be OM and 10 digits, for example OM1100123456', 'err'); return; }
    setBusy(true);
    try { await saveSellerExtra(c.key, { vat, name_ar: f.name_ar.trim() }); flash(`${c.short}: e-invoice details saved`); onClose(); } catch (x) { flash(x.message, 'err'); }
    setBusy(false);
  }
  return (
    <Modal title={`🧾 E-invoice details · ${c.short}`} onClose={onClose}>
      {!f ? <p className="muted">Loading...</p> : (
        <form onSubmit={save} className="cp-form">
          <p className="muted" style={{ margin: 0 }}>Printed on every new invoice of {c.short} (and in its QR / XML). Invoices already saved keep their details.</p>
          <label><span>Company name (English)</span><input className="drv-input" value={c.name || c.short} readOnly /></label>
          <label><span>Company name in Arabic (as on the CR)</span><input className="drv-input" dir="rtl" lang="ar" value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} /></label>
          <label><span>VAT No. (OM + 10 digits)</span><input className="drv-input" value={f.vat} placeholder="OM1100000000" onChange={(e) => setF({ ...f, vat: e.target.value })} autoCapitalize="characters" /></label>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn in" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Companies({ flash, access, reload, me }) {
  const [, setTick] = useState(0);
  const [box, setBox] = useState(null); // { kind: edit|delete|remove, c }
  const [bk, setBk] = useState('');
  const refresh = () => { setTick((t) => t + 1); reload(); };
  async function backup(c) {
    setBk(c.key);
    try { await backupOf(c.key); flash(`${c.short}: backup downloaded`); } catch (e) { flash(e.message, 'err'); }
    setBk('');
  }
  return (
    <>
      <div className="ca-head">
        <h2 className="adm-h">🏢 Companies</h2>
        <AddCompany flash={flash} onAdded={() => refresh()} />
      </div>
      <div className="ca-list">
        {COMPANIES.map((c) => {
          const fixed = FIXED.includes(c.key);
          const users = new Set(access.filter((r) => r.company === c.key || r.company === ALL_CO).map((r) => r.user_id)).size;
          return (
            <section key={c.key} className="ca-card">
              <div className="ca-top">
                {c.logo ? <span className="adm-co-logo"><img src={c.logo} alt="" /></span> : <span className="adm-ico" aria-hidden="true">🏢</span>}
                <div className="ca-tx">
                  <b>{c.short}</b>
                  <small>{c.name}{c.cr ? ` · ${c.cr}` : ''}</small>
                  <small>{fixed ? 'Main company' : 'Added company'} · {users} user{users === 1 ? '' : 's'} with access (+ Administrators)</small>
                </div>
              </div>
              <div className="ca-btns">
                <Link href={`/company/${c.key}`} className="btn ghost small">↗ Open</Link>
                {!fixed && <button type="button" className="btn ghost small" onClick={() => setBox({ kind: 'edit', c })}>✏️ Edit details</button>}
                <button type="button" className="btn ghost small" onClick={() => setBox({ kind: 'einv', c })}>🧾 E-invoice details</button>
                <button type="button" className="btn ghost small" onClick={() => backup(c)} disabled={bk === c.key}>{bk === c.key ? 'Making...' : '⬇ Backup'}</button>
                <button type="button" className="btn ghost small" onClick={() => { lockCompany(c.key); flash(`${c.short} locked in this tab`); }}>🔒 Lock</button>
                <button type="button" className="btn ghost small ca-red" onClick={() => setBox({ kind: 'delete', c })}>🗑 Delete data</button>
                {!fixed && <button type="button" className="btn ghost small ca-red" onClick={() => setBox({ kind: 'remove', c })}>✖ Remove company</button>}
              </div>
            </section>
          );
        })}
      </div>
      {box?.kind === 'einv' && <EinvBox c={box.c} flash={flash} onClose={() => setBox(null)} />}
      {box?.kind === 'edit' && <EditBox c={box.c} flash={flash} onClose={() => setBox(null)} onDone={() => { setBox(null); refresh(); }} />}
      {(box?.kind === 'delete' || box?.kind === 'remove') && <DangerBox c={box.c} mode={box.kind} me={me} flash={flash} onClose={() => setBox(null)} onDone={() => { setBox(null); refresh(); }} />}
    </>
  );
}

/* 🔑 Administrator: give users access to any company */
function CompanyAccess({ me }) {
  const [users, setUsers] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    try {
      const [{ data, error }, acc] = await Promise.all([sb().rpc('admin_list_users'), loadAllAccess()]);
      if (error) throw error;
      setUsers((data || []).filter((u) => u.role !== 'driver'));
      setRows(acc);
    } catch (e) { setMsg(e.message); setUsers([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const has = (u, c) => rows.some((r) => r.user_id === u && r.company === c);
  const allOf = (u) => has(u, ALL_CO); // given All companies (Admin › Users / Create users)

  async function toggle(u, c, on) {
    const id = `${u}|${c}`;
    setBusy(id); setMsg('');
    try {
      await setAccess(u, c, on, me.name);
      setRows((rs) => (on ? [...rs, { user_id: u, company: c }] : rs.filter((r) => !(r.user_id === u && r.company === c))));
    } catch (e) { setMsg(e.message); }
    setBusy('');
  }

  if (users === null) return <p className="muted">Loading users...</p>;
  return (
    <>
      <h2 className="adm-h">👥 Users and their companies</h2>
      <p className="sub">Tick the companies each user may open in All Companies. Administrators always open every company. The password is still asked.</p>
      {msg && <div className="error">{msg}</div>}
      <div className="table-wrap">
        <table className="adm-acc">
          <thead>
            <tr><th>User</th><th>Level</th>{COMPANIES.map((c) => <th key={c.key} className="ctr">{c.short}</th>)}</tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const admin = u.role === 'admin';
              const every = admin || allOf(u.id);
              return (
                <tr key={u.id}>
                  <td><b>{u.display_name || u.username}</b><small className="muted"> {u.username}</small></td>
                  <td>{ROLES[u.role]?.label || u.role}</td>
                  {COMPANIES.map((c) => (
                    <td key={c.key} className="ctr">
                      <input type="checkbox" aria-label={`${u.display_name || u.username} · ${c.short}`}
                        checked={every || has(u.id, c.key)} disabled={every || busy === `${u.id}|${c.key}`}
                        title={admin ? 'Administrator: every company' : every ? 'All companies (change it in Admin › Users)' : ''}
                        onChange={(e) => toggle(u.id, c.key, e.target.checked)} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}


function CompanyAccessPage() {
  const user = useUser();
  const [toast, setToast] = useState(null);
  const [access, setAcc] = useState([]);
  const [key, setKey] = useState(0);
  const flash = useCallback((text, kind = 'ok') => { setToast({ text, kind }); setTimeout(() => setToast(null), 3000); }, []);
  const reload = useCallback(() => { loadAllAccess().then(setAcc).catch(() => {}); setKey((k) => k + 1); }, []);
  useEffect(() => { loadAllAccess().then(setAcc).catch(() => {}); }, []);
  return (
    <>
      <h1>🏢 Company access</h1>
      <p className="sub">Every company and who may open it. Add, edit or remove a company, download a backup, delete a company's data.</p>
      <Companies flash={flash} access={access} reload={reload} me={user} />
      <CompanyAccess key={key} me={user} />
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
    </>
  );
}

export default function Page() {
  return <AuthGate ownerOnly><CompanyAccessPage /></AuthGate>;
}
