'use client';

import { useEffect, useState } from 'react';
import AuthGate, { useUser } from '@/components/AuthGate';
import Modal from '@/components/Modal';
import { sb } from '@/lib/supabase';
import { COMPANIES } from '@/lib/expenses';

/*
  👥 Users of my company (19 Nov 2026, Kamran): the company owner (signed up himself) and his Company administrators
  make logins for their staff. Each login: full name, username, password, designation (Manager, Accountant,
  Finance Manager, HR Manager, Sales Manager ... or typed), access level and which of HIS companies.
  RPCs team_list_users / team_save_user / team_delete_user (Supabase migration company_owner_team_users).
  They never see other owners' users or companies.
*/
const DESIGNATIONS = ['Manager', 'General Manager', 'Accountant', 'Finance Manager', 'HR Manager', 'Sales Manager', 'Operations Manager',
  'Purchasing Officer', 'Store Keeper', 'Admin Officer', 'Secretary', 'Supervisor', 'Employee'];
const LEVELS = [
  ['cadmin', 'Company administrator', 'Full access + can make and change users'],
  ['editor', 'Full access', 'See and change everything in the ticked companies'],
  ['entry', 'Data entry', 'Add and change data, cannot delete'],
  ['viewer', 'View only', 'See only, cannot change anything']
];
const levelOf = (u) => (u.cadmin ? 'cadmin' : u.role);
const levelName = (k) => LEVELS.find((l) => l[0] === k)?.[1] || k;
const coName = (k) => COMPANIES.find((c) => c.key === k)?.short || k;

function Team() {
  const me = useUser();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [box, setBox] = useState(null);
  const [del, setDel] = useState(null);

  async function load() {
    const { data, error } = await sb().rpc('team_list_users');
    if (error) { setErr(error.message); setRows([]); return; }
    setRows(data || []);
  }
  useEffect(() => { if (me.isTeamAdmin) load(); }, [me.isTeamAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me.isTeamAdmin) return <p className="empty">Only the company owner or a company administrator can open Users.</p>;

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 4000); };
  const newBox = () => setBox({ id: null, name: '', username: '', password: '', level: 'editor', desig: DESIGNATIONS[0], other: '', companies: COMPANIES.length === 1 ? [COMPANIES[0].key] : [] });
  const editBox = (u) => {
    const d = u.designation || '';
    setBox({ id: u.id, name: u.name, username: u.username, password: '', level: levelOf(u), desig: DESIGNATIONS.includes(d) ? d : d ? 'Other' : DESIGNATIONS[0], other: DESIGNATIONS.includes(d) ? '' : d, companies: u.companies || [] });
  };

  return (
    <>
      <div className="home-hero">
        <span className="home-kicker">{COMPANIES.map((c) => c.short).join(' · ')}</span>
        <h1 className="center">👥 Users</h1>
        <span className="home-rule" aria-hidden="true"><i /></span>
      </div>
      <p className="muted center" style={{ marginTop: 0 }}>Make logins for your staff and choose what each person can do. They see only the companies you tick.</p>
      {msg && <div className="ok-msg">{msg}</div>}
      {err && <div className="error">{err}</div>}
      <div className="ac-actions" style={{ justifyContent: 'center', margin: '8px 0 14px' }}>
        <button type="button" className="btn" onClick={newBox}>＋ New user</button>
      </div>
      {rows === null ? <p className="muted center">Loading...</p> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Username</th><th>Designation</th><th>Access</th><th>Companies</th><th>Last login</th><th /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.name}</b>{u.id === me.id ? ' (you)' : ''}</td>
                  <td>{u.username}</td>
                  <td>{u.designation || ''}</td>
                  <td>{u.is_owner ? 'Company owner' : levelName(levelOf(u))}</td>
                  <td>{u.is_owner ? 'All my companies' : (u.companies || []).map(coName).join(', ')}</td>
                  <td>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}</td>
                  <td className="nowrap">
                    {!u.is_owner && u.id !== me.id && <>
                      <button type="button" className="mini" onClick={() => editBox(u)}>Edit</button>{' '}
                      <button type="button" className="mini danger" onClick={() => setDel(u)}>Delete</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {box && <UserBox box={box} setBox={setBox} onDone={(t) => { setBox(null); flash(t); load(); }} />}
      {del && (
        <Modal title="Delete user" onClose={() => setDel(null)}>
          <p style={{ marginTop: 0 }}>Delete the login of <b>{del.name}</b> ({del.username})? He cannot log in any more. The data he entered stays.</p>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={() => setDel(null)}>Cancel</button>
            <button type="button" className="btn danger" onClick={async () => {
              const { error } = await sb().rpc('team_delete_user', { p_id: del.id });
              setDel(null);
              if (error) setErr(error.message); else { flash(`${del.name} deleted`); load(); }
            }}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function UserBox({ box, setBox, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setBox((b) => ({ ...b, [k]: e.target.value }));
  const tick = (k) => setBox((b) => ({ ...b, companies: b.companies.includes(k) ? b.companies.filter((x) => x !== k) : [...b.companies, k] }));

  async function save(e) {
    e.preventDefault();
    setErr('');
    const designation = box.desig === 'Other' ? box.other.trim() : box.desig;
    if (box.name.trim().length < 2) { setErr('Type the full name.'); return; }
    if (!box.id && !/^[a-z0-9._-]{3,30}$/.test(box.username.trim().toLowerCase())) { setErr('Username must be 3 to 30 letters or numbers, no spaces.'); return; }
    if (!box.id && box.password.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (box.id && box.password && box.password.length < 6) { setErr('New password must be at least 6 characters.'); return; }
    if (!box.companies.length) { setErr('Tick at least one company.'); return; }
    if (box.desig === 'Other' && !designation) { setErr('Type the designation.'); return; }
    setBusy(true);
    const cadmin = box.level === 'cadmin';
    const { error } = await sb().rpc('team_save_user', {
      p_id: box.id, p_username: box.username.trim().toLowerCase(), p_password: box.password || null, p_display: box.name.trim(),
      p_role: cadmin ? 'editor' : box.level, p_cadmin: cadmin, p_designation: designation, p_companies: box.companies
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone(box.id ? `${box.name.trim()} saved` : `${box.name.trim()} can now log in with username ${box.username.trim().toLowerCase()}`);
  }

  return (
    <Modal title={box.id ? `✏️ Edit · ${box.name}` : '＋ New user'} onClose={() => setBox(null)}>
      <form onSubmit={save} className="cp-form">
        <div className="ac-grid">
          <label><span>Full name</span><input value={box.name} onChange={set('name')} placeholder="e.g. Salman Al Harthy" /></label>
          <label><span>Username</span><input value={box.username} onChange={set('username')} disabled={!!box.id} autoCapitalize="none" autoComplete="off" placeholder="e.g. salman" /></label>
          <label><span>{box.id ? 'New password (leave empty to keep)' : 'Password'}</span><input type="text" value={box.password} onChange={set('password')} autoComplete="new-password" placeholder="At least 6 characters" /></label>
          <label><span>Designation</span>
            <select value={box.desig} onChange={set('desig')}>{[...DESIGNATIONS, 'Other'].map((d) => <option key={d} value={d}>{d === 'Other' ? 'Other (type it)' : d}</option>)}</select>
          </label>
          {box.desig === 'Other' && <label className="wide"><span>Type the designation</span><input value={box.other} onChange={set('other')} placeholder="e.g. Marketing Manager" /></label>}
        </div>
        <p className="dfl-label" style={{ margin: '12px 0 4px' }}>Access (what he can do)</p>
        <div className="tm-levels">
          {LEVELS.map(([k, label, sub]) => (
            <label key={k} className={`tm-level${box.level === k ? ' on' : ''}`}>
              <input type="radio" name="lvl" checked={box.level === k} onChange={() => setBox((b) => ({ ...b, level: k }))} />
              <span><b>{label}</b><small>{sub}</small></span>
            </label>
          ))}
        </div>
        <p className="dfl-label" style={{ margin: '12px 0 4px' }}>Companies he can open</p>
        <div className="tm-cos">
          {COMPANIES.map((c) => (
            <label key={c.key} className={`tm-co${box.companies.includes(c.key) ? ' on' : ''}`}>
              <input type="checkbox" checked={box.companies.includes(c.key)} onChange={() => tick(c.key)} /> {c.short}
            </label>
          ))}
        </div>
        {err && <div className="error" style={{ marginTop: 10 }}>{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={() => setBox(null)}>Cancel</button>
          <button type="submit" className="btn in" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Page() {
  return <AuthGate wide><Team /></AuthGate>;
}
