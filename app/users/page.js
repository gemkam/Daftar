'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGate, { ROLES, useUser } from '@/components/AuthGate';
import FaisalPicturePanel from '@/components/FaisalPicturePanel';
import Modal from '@/components/Modal';
import { sb } from '@/lib/supabase';
import { logAction } from '@/lib/activity';
import CompanyMulti, { companyLabel } from '@/components/CompanyMulti';
import { accessByUser, saveUserCompanies, pagesByUser } from '@/lib/companyAccess';
import CompanyPagesPick from '@/components/CompanyPagesPick';
import { COMPANIES } from '@/lib/expenses';
import DesignationPick, { designationsByUser, saveUserDesignation, loadDesignations, DEFAULT_DESIGNATIONS } from '@/components/DesignationPick';

const ROLE_HELP = {
  admin: 'Everything, plus the Admin panel (users, settings, activity)',
  editor: 'See and edit all data. No Admin panel (users, settings, activity)',
  viewer: 'See everything, change nothing',
  entry: 'See everything, add and edit data on every page. Cannot delete. No Admin panel.',
  driver: 'Only his own Driver trip form (his trips and papers). Nothing else.'
};
const ROLE_ORDER = ['admin', 'editor', 'viewer', 'entry', 'driver'];
const EMPTY = { username: '', display: '', password: '', role: 'viewer', asDriver: true, vehicle: '', driverPick: '', companies: [], pages: {}, driverCo: 'al-noor' }; // driverCo: company the driver belongs to (transport_drivers.company, 11 Nov 2026) // companies: keys or ['*'] = All companies (11 Nov 2026) // driverPick: existing driver id | 'new' | 'none'

function fmtWhen(d) {
  if (!d) return 'Never';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RolePicker({ value, onChange, name }) {
  return (
    <div className="role-pick" role="radiogroup" aria-label="Access level">
      {ROLE_ORDER.map((r) => (
        <label key={r} className={`role-opt ${value === r ? 'on' : ''}`}>
          <input type="radio" name={name} value={r} checked={value === r} onChange={() => onChange(r)} />
          <span className="role-opt-title">{ROLES[r].label}</span>
          <span className="role-opt-help">{ROLE_HELP[r]}</span>
        </label>
      ))}
    </div>
  );
}

function UsersPage() {
  const me = useUser();
  const [users, setUsers] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showPw, setShowPw] = useState(false);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [seen, setSeen] = useState({});
  const [acc, setAcc] = useState({}); // userId -> company keys
  const [desig, setDesig] = useState({}); // userId -> designation (Create users), column renamed from Driver (Owner 11 Nov 2026)
  const [desOpts, setDesOpts] = useState(DEFAULT_DESIGNATIONS); // filter of the Designation column lists them all
  const [pgs, setPgs] = useState({}); // userId -> { company: pages | null } (🔑 access per page)

  const load = useCallback(async () => {
    accessByUser().then(setAcc).catch(() => {});
    pagesByUser().then(setPgs).catch(() => {});
    designationsByUser().then(setDesig).catch(() => {});
    loadDesignations().then(setDesOpts).catch(() => {});
    const [{ data, error: err }, d] = await Promise.all([
      sb().rpc('admin_list_users'),
      sb().from('transport_drivers').select('id, name, vehicle_no, user_id, sort, company').is('archived_at', null).order('sort')
    ]);
    if (err) { setError(err.message); setUsers([]); return; }
    setUsers(data || []);
    setDrivers(d.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Online now / last seen per user (from the activity log)
  const loadSeen = useCallback(async () => {
    const { data } = await sb().from('user_sessions').select('user_id, last_seen, ended_at').order('last_seen', { ascending: false }).limit(500);
    const m = {};
    (data || []).forEach((s) => {
      const online = !s.ended_at && Date.now() - new Date(s.last_seen).getTime() < 150000;
      if (!m[s.user_id]) m[s.user_id] = { last: s.last_seen, online };
      else if (online) m[s.user_id].online = true;
    });
    setSeen(m);
  }, []);

  useEffect(() => {
    loadSeen();
    const t = setInterval(loadSeen, 30000);
    return () => clearInterval(t);
  }, [loadSeen]);

  function flash(t) { setMsg(t); setTimeout(() => setMsg(''), 3500); }

  async function create(e) {
    e.preventDefault();
    setError('');
    const needCo = form.role !== 'admin' && form.role !== 'driver';
    if (needCo && !form.companies.length) { setError('Choose the company (one or more, or All companies)'); return; }
    setBusy(true);
    const { data: newId, error: err } = await sb().rpc('admin_create_user', {
      p_username: form.username.trim(), p_password: form.password, p_display: form.display.trim(), p_role: form.role
    });
    if (err) { setBusy(false); setError(err.message); return; } // shown at the top AND right above the Create button
    let extra = '';
    const pickD = form.driverPick || (drivers.some((d) => !d.user_id) ? '' : 'new');
    if (form.role === 'driver' && pickD && pickD !== 'none' && pickD !== 'new') {
      // an existing driver (e.g. Saif Altaf): link this login to him, so the form opens on his name only
      const { error: dErr } = await sb().from('transport_drivers').update({ user_id: newId, ...(form.driverCo ? { company: form.driverCo } : {}) }).eq('id', pickD);
      extra = dErr ? ` (Could not link to the driver: ${dErr.message})` : ` Linked to driver ${drivers.find((d) => d.id === pickD)?.name || ''}.`;
    } else if (form.role === 'driver' && pickD === 'new') {
      const sort = drivers.reduce((m, x) => Math.max(m, x.sort || 0), 0) + 1;
      const { error: dErr } = await sb().from('transport_drivers').insert({ name: form.display.trim() || form.username.trim(), vehicle_no: form.vehicle.trim() || null, user_id: newId, sort, company: form.driverCo || 'al-noor' });
      extra = dErr ? ` (Could not add to the driver list: ${dErr.message})` : ' Added to the driver list.';
    }
    if (needCo) {
      try { await saveUserCompanies(newId, form.companies, me.name, form.pages); } catch (x) { extra += ` (Could not save the company: ${x.message})`; }
    }
    setBusy(false);
    logAction(`Created user "${form.username.trim().toLowerCase()}" with ${ROLES[form.role].label}${needCo ? `, companies: ${companyLabel(form.companies).replace('🏢 ', '')}` : ''}`);
    flash(`User "${form.username.trim().toLowerCase()}" created with ${ROLES[form.role].label}. They can log in now.${extra}`);
    setForm(EMPTY);
    load();
  }

  async function saveEdit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const { error: err } = await sb().rpc('admin_update_user', {
      p_id: edit.id, p_role: edit.role, p_display: edit.display_name, p_password: edit.password ? edit.password : null
    });
    if (err) { setBusy(false); setError(err.message); return; }
    let coErr = '';
    const oldCo = acc[edit.id] || [];
    const pgChanged = edit.role !== 'admin' && edit.role !== 'driver' && JSON.stringify(edit.pages || {}) !== JSON.stringify(pgs[edit.id] || {});
    const coChanged = edit.role !== 'admin' && edit.role !== 'driver' && companyLabel(oldCo) !== companyLabel(edit.companies);
    if (coChanged || pgChanged) { try { await saveUserCompanies(edit.id, edit.companies, me.name, edit.pages || {}); } catch (x) { coErr = ` Could not save the company: ${x.message}`; } }
    const current = drivers.find((d) => d.user_id === edit.id)?.id || '';
    if (edit.driverId !== current) {
      if (current) await sb().from('transport_drivers').update({ user_id: null }).eq('id', current);
      if (edit.driverId === 'new') {
        const sort = drivers.reduce((m, x) => Math.max(m, x.sort || 0), 0) + 1;
        await sb().from('transport_drivers').insert({ name: edit.display_name || edit.username, user_id: edit.id, sort, company: edit.driverCo || 'al-noor' });
      } else if (edit.driverId) {
        await sb().from('transport_drivers').update({ user_id: edit.id }).eq('id', edit.driverId);
      }
    }
    // Designation (one or more), same as Create users (Owner 11 Nov 2026)
    const newDes = (edit.designation || []).join(', ');
    if (newDes !== (desig[edit.id] || '')) {
      try {
        if (newDes) await saveUserDesignation(edit.id, newDes);
        else await sb().from('user_designations').delete().eq('user_id', edit.id);
      } catch (x) { coErr += ` Could not save the designation: ${x.message}`; }
    }
    // 🏢 company the driver belongs to (11 Nov 2026)
    const dRow = drivers.find((d) => d.id === edit.driverId);
    if (dRow && edit.driverCo && dRow.company !== edit.driverCo) await sb().from('transport_drivers').update({ company: edit.driverCo }).eq('id', dRow.id);
    setBusy(false);
    const before = (users || []).find((x) => x.id === edit.id);
    const bits = [];
    if (before && before.role !== edit.role) bits.push(`access ${ROLES[before.role]?.label || before.role} → ${ROLES[edit.role]?.label || edit.role}`);
    if (before && (before.display_name || '') !== (edit.display_name || '')) bits.push(`name "${before.display_name || ''}" → "${edit.display_name || ''}"`);
    if (edit.password) bits.push('password changed');
    if (coChanged && !coErr) bits.push(`companies ${companyLabel(oldCo).replace('🏢 ', '')} → ${companyLabel(edit.companies).replace('🏢 ', '')}`);
    logAction(`Edited user "${edit.username}"${bits.length ? ': ' + bits.join(', ') : ''}`);
    flash(`${edit.display_name || edit.username} saved.${edit.id !== me.id ? ' They were signed out, and the new access applies at their next login.' : ''}${coErr}`);
    setEdit(null);
    load();
  }

  async function confirmDelete() {
    setBusy(true); setError('');
    const { error: err } = await sb().rpc('admin_delete_user', { p_id: del.id });
    setBusy(false);
    if (err) { setError(err.message); return; }
    logAction(`Deleted user "${del.username}"`);
    flash(`${del.display_name || del.username} deleted.`);
    setDel(null);
    load();
  }

  const counts = ROLE_ORDER.map((r) => [r, (users || []).filter((u) => u.role === r).length]);

  return (
    <>
      <div className="page-tools">
        <Link href="/" className="crumb">← Home</Link>
      </div>
      <div>
        <h1>Users and access</h1>
        <p className="sub">Create logins and choose what each person can do.</p>
      </div>

      {error && <div className="error">{error}</div>}
      {msg && <div className="ok-msg">{msg}</div>}

      <div className="kpi-row">
        {counts.map(([r, c]) => (
          <div className="kpi" key={r}><span>{ROLES[r].label}</span><strong>{c}</strong><small>{ROLE_HELP[r]}</small></div>
        ))}
      </div>

      <FaisalPicturePanel />

      <section className="panel">
        <h2>Create a new user</h2>
        <form onSubmit={create} style={{ display: 'grid', gap: 14 }}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="nu-user">Username</label>
              <input id="nu-user" required autoComplete="off" autoCapitalize="none" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, '') })} placeholder="e.g. rashid" />
            </div>
            <div className="field">
              <label htmlFor="nu-name">Display name</label>
              <input id="nu-name" value={form.display} onChange={(e) => setForm({ ...form, display: e.target.value })} placeholder="e.g. Rashid Khan" />
            </div>
            <div className="field">
              <label htmlFor="nu-pass">Password</label>
              <div className="pw-wrap">
                <input id="nu-pass" required type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 4 characters" />
                <button type="button" className="pw-eye" onClick={() => setShowPw((v) => !v)}>{showPw ? 'Hide' : 'Show'}</button>
              </div>
            </div>
          </div>
          <div className="field">
            <label>Access level</label>
            <RolePicker value={form.role} onChange={(r) => setForm({ ...form, role: r })} name="new-role" />
          </div>
          {form.role !== 'driver' && (
            <div className="field" style={{ maxWidth: 420 }}>
              <label htmlFor="nu-co">Which company? (one or more)</label>
              <CompanyMulti id="nu-co" value={form.companies} allLocked={form.role === 'admin'} onChange={(k) => setForm({ ...form, companies: k })} />
              <small className="muted">{form.role === 'admin' ? 'An Administrator always opens every company.' : 'They see only these companies in All Companies. All companies also covers companies added later.'}</small>
              {form.role !== 'admin' && form.role !== 'driver' && <CompanyPagesPick keys={form.companies} value={form.pages} role={form.role} onChange={(pages) => setForm({ ...form, pages })} />}
            </div>
          )}
          {form.role === 'driver' && (
            <div className="driver-link">
              <div className="field" style={{ maxWidth: 360 }}>
                <label htmlFor="nu-driver">Which driver is this login for?</label>
                <select id="nu-driver" value={form.driverPick} onChange={(e) => setForm({ ...form, driverPick: e.target.value, driverCo: drivers.find((d) => d.id === e.target.value)?.company || form.driverCo || 'al-noor' })} required>
                  <option value="">Choose the driver</option>
                  {drivers.filter((d) => !d.user_id).map((d) => <option key={d.id} value={d.id}>{d.name}{d.vehicle_no ? ` (${d.vehicle_no})` : ''}</option>)}
                  <option value="new">➕ A new driver (add to the driver list)</option>
                  <option value="none">Not a driver</option>
                </select>
                <small className="muted">The driver will see only his own name and trips on the Driver trip form.</small>
              </div>
              {form.driverPick !== 'none' && (
                <div className="field" style={{ maxWidth: 300 }}>
                  <label htmlFor="nu-dco">Which company does he belong to?</label>
                  <select id="nu-dco" value={form.driverCo || ''} onChange={(e) => setForm({ ...form, driverCo: e.target.value })}>
                  <option value="">– choose –</option>
                  {COMPANIES.map((c) => <option key={c.key} value={c.key}>{c.short}</option>)}
                </select>
                </div>
              )}
              {form.driverPick === 'new' && (
                <div className="field narrow" style={{ maxWidth: 260 }}>
                  <label htmlFor="nu-veh">Vehicle number</label>
                  <input id="nu-veh" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="e.g. 899 YR" />
                </div>
              )}
            </div>
          )}
          {error && <div className="error" role="alert">❌ Not created: {error}</div>}
          {msg && <div className="ok-msg" role="status">{msg}</div>}
          <div><button type="submit" className="btn in" disabled={busy}>{busy ? 'Creating...' : 'Create user'}</button></div>
        </form>
      </section>

      <section className="panel">
        <h2>All users {users && <span className="note">({users.length})</span>} <Link href="/activity" className="btn small ghost" style={{ marginLeft: 10 }}>👁 All users activity</Link></h2>
        {!users ? <p className="empty">Loading users...</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Username</th><th>Access level</th><th>Companies</th><th data-filter-split="," data-filter-options={[...desOpts, 'Driver'].join('|')}>Designation</th><th>Status</th><th>Last login</th><th className="num">Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><b>{u.display_name}</b>{u.id === me.id && <span className="pill neutral" style={{ marginLeft: 8 }}>You</span>}</td>
                    <td>{u.username}</td>
                    <td><span className={`role-badge r-${u.role}`}>{ROLES[u.role]?.label || u.role || 'No access'}</span></td>
                    <td>{u.role === 'admin' ? 'All companies' : u.role === 'driver' ? (COMPANIES.find((c) => c.key === drivers.find((d) => d.user_id === u.id)?.company)?.short || <span className="muted">–</span>) : acc[u.id]?.length ? companyLabel(acc[u.id]).replace('🏢 ', '') : <span className="muted">No company yet</span>}</td>
                    <td>{desig[u.id] || (drivers.some((d) => d.user_id === u.id) ? 'Driver' : <span className="muted">–</span>)}</td>
                    <td>{seen[u.id]?.online ? <span className="pill in">🟢 Online now</span> : seen[u.id] ? <span className="muted">Last seen {fmtWhen(seen[u.id].last)}</span> : <span className="muted">–</span>}</td>
                    <td>{fmtWhen(u.last_sign_in_at)}</td>
                    <td>
                      <div className="actions">
                        <Link href={`/activity?u=${u.id}`} className="mini">📜 Activity</Link>
                        <button type="button" className="mini" onClick={() => setEdit({ ...u, password: '', companies: acc[u.id] || [], pages: pgs[u.id] || {}, driverId: drivers.find((d) => d.user_id === u.id)?.id || '', driverCo: drivers.find((d) => d.user_id === u.id)?.company || '', designation: desig[u.id] ? desig[u.id].split(',').map((x) => x.trim()).filter(Boolean) : [] })}>Edit</button>
                        {u.id !== me.id && <button type="button" className="mini danger" onClick={() => setDel(u)}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="note">Usernames work in capitals or small letters. When you change someone&apos;s access, they are signed out and the new access applies when they log in again.</p>
      </section>

      {edit && (
        <Modal title={`Edit ${edit.display_name || edit.username}`} onClose={() => setEdit(null)}>
          <form onSubmit={saveEdit} style={{ display: 'grid', gap: 12 }}>
            <div className="field">
              <label htmlFor="eu-name">Display name</label>
              <input id="eu-name" value={edit.display_name} onChange={(e) => setEdit({ ...edit, display_name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="eu-pass">New password (leave empty to keep the current one)</label>
              <input id="eu-pass" type="text" autoComplete="new-password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} placeholder="Keep current password" />
            </div>
            <div className="field">
              <label htmlFor="eu-desig">Designation (one or more)</label>
              <DesignationPick id="eu-desig" value={edit.designation} onChange={(d) => setEdit((x) => ({ ...x, designation: d }))} />
            </div>
            <div className="field">
              <label>Access level</label>
              <RolePicker value={edit.role} onChange={(r) => setEdit({ ...edit, role: r })} name="edit-role" />
            </div>
            {edit.role !== 'driver' && (
              <div className="field">
                <label htmlFor="eu-co">Which company? (one or more)</label>
                <CompanyMulti id="eu-co" value={edit.companies} allLocked={edit.role === 'admin'} onChange={(k) => setEdit({ ...edit, companies: k })} />
                {edit.role !== 'admin' && <CompanyPagesPick keys={edit.companies} value={edit.pages} role={edit.role} onChange={(pages) => setEdit({ ...edit, pages })} />}
              </div>
            )}
            <div className="field">
              <label htmlFor="eu-driver">Driver in the list (for the Driver level)</label>
              <select id="eu-driver" value={edit.driverId} onChange={(e) => setEdit({ ...edit, driverId: e.target.value, driverCo: drivers.find((d) => d.id === e.target.value)?.company || edit.driverCo || 'al-noor' })}>
                <option value="">Not a driver</option>
                {drivers.filter((d) => !d.user_id || d.user_id === edit.id).map((d) => <option key={d.id} value={d.id}>{d.name}{d.vehicle_no ? ` (${d.vehicle_no})` : ''}</option>)}
                <option value="new">+ Add as a new driver</option>
              </select>
            </div>
            {edit.driverId && (
              <div className="field">
                <label htmlFor="eu-dco">Which company does he belong to?</label>
                <select id="eu-dco" value={edit.driverCo || ''} onChange={(e) => setEdit({ ...edit, driverCo: e.target.value })}>
                  <option value="">– choose –</option>
                  {COMPANIES.map((c) => <option key={c.key} value={c.key}>{c.short}</option>)}
                </select>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
              <button type="submit" className="btn in" disabled={busy}>Save</button>
            </div>
          </form>
        </Modal>
      )}

      {del && (
        <Modal title="Delete user?" onClose={() => setDel(null)}>
          <p style={{ margin: 0 }}>Delete <strong>{del.display_name}</strong> ({del.username})? They will not be able to log in any more. Data they entered stays.</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setDel(null)}>Cancel</button>
            <button className="btn danger" onClick={confirmDelete} disabled={busy}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Page() {
  return <AuthGate ownerOnly><UsersPage /></AuthGate>;
}
