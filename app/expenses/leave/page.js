'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import CoBar from '@/components/CoBar';
import { sb, fmtDate } from '@/lib/supabase';
import { useCoPick, todayISO, addDays } from '@/lib/coPick';
import { isOffDay } from '@/lib/attendance';
import { withEditPassword } from '@/lib/editLock';

/*
  🌴 Leave requests (27 Nov 2026, Kamran). Table leave_requests (database/12_crm_quotes_leave.sql).
  - Data entry and Full access add a request for an employee: type, from, to, reason.
    Working days are counted by themselves (Office staff: Friday and Saturday off, Site staff: Friday off).
  - Only Full access (Administrator / editor) can ✅ Approve or ✗ Reject. Data entry can not (database rule too).
  - ✅ Approve marks the working days in Attendance by itself: Leave (L), or Absent (A) for Unpaid leave,
    so the salary sheet follows. ↶ Undo approval takes those marks out again (only the marks this page made).
  - Annual leave used this year per employee, out of 30 days (Oman Labour Law 53/2023). Change ANNUAL_DAYS if the contract says other.
*/

const TYPES = ['Annual', 'Sick', 'Emergency', 'Unpaid', 'Maternity', 'Hajj', 'Other'];
const ANNUAL_DAYS = 30;
const TAG = '(leave request)';
const STATUS = { pending: ['Pending', 'neutral'], approved: ['Approved', 'ok'], rejected: ['Rejected', 'low'] };

function daysBetween(from, to) {
  const out = [];
  if (!from || !to || to < from) return out;
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}
const workDays = (from, to, type) => daysBetween(from, to).filter((d) => !isOffDay(d, type));
const blank = () => ({ id: null, staff_id: '', leave_type: 'Annual', date_from: todayISO(), date_to: todayISO(), reason: '' });

function Leave() {
  const user = useUser();
  const me = user.name || user.username;
  const pick = useCoPick(user, '/expenses/leave');
  const { co, company: C } = pick;
  const [staff, setStaff] = useState([]);
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const canAdd = !!user.isAdmin;
  const canDecide = !!user.canDelete; // Full access only
  const today = todayISO();
  const year = today.slice(0, 4);

  async function load() {
    if (!co) return;
    const s = sb();
    const [st, lr] = await Promise.all([
      s.from('exp_staff').select('id, name, designation, department, staff_type, active').eq('company', co).order('sort').order('name'),
      s.from('leave_requests').select('*').eq('company', co).order('date_from', { ascending: false })
    ]);
    if (lr.error) { setMsg(/leave_requests|does not exist|schema cache/i.test(lr.error.message) ? 'The Leave table is not in the database yet. Run database/12_crm_quotes_leave.sql in Supabase.' : lr.error.message); setList([]); return; }
    setStaff((st.data || []).filter((x) => x.active !== false));
    setList(lr.data || []);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setList(null); setForm(null); load(); }, [co]);

  const person = (id) => staff.find((x) => x.id === id);
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v, ...(k === 'date_from' && f.date_to < v ? { date_to: v } : {}) }));
  const formDays = form ? workDays(form.date_from, form.date_to, person(form.staff_id)?.staff_type).length : 0;

  async function save(e) {
    e.preventDefault();
    if (!form.staff_id) { setMsg('Choose the employee.'); return; }
    if (form.date_to < form.date_from) { setMsg('"To" is before "From".'); return; }
    if (!formDays) { setMsg('These dates are only weekend days. Choose working days.'); return; }
    const clash = (list || []).find((r) => r.id !== form.id && r.staff_id === form.staff_id && r.status !== 'rejected' && r.date_from <= form.date_to && r.date_to >= form.date_from);
    if (clash && !window.confirm(`${person(form.staff_id)?.name} already has leave ${fmtDate(clash.date_from)} to ${fmtDate(clash.date_to)}. Save anyway?`)) return;
    setBusy(true); setMsg('');
    const row = { company: co, staff_id: form.staff_id, leave_type: form.leave_type, date_from: form.date_from, date_to: form.date_to, days: formDays, reason: form.reason || null, updated_at: new Date().toISOString() };
    const s = sb().from('leave_requests');
    const { error } = form.id ? await s.update(row).eq('id', form.id) : await s.insert({ ...row, status: 'pending', requested_by: me });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setForm(null); setFilter('pending'); setMsg(form.id ? '✓ Saved' : '✓ Request added. Waiting for approval.');
    load();
  }

  // ✅ approve: mark the working days in Attendance
  async function marks(r, on) {
    const p = person(r.staff_id);
    const days = workDays(r.date_from, r.date_to, p?.staff_type);
    const s = sb().from('exp_attendance');
    if (on) {
      const unpaid = r.leave_type === 'Unpaid';
      const rows = days.map((day) => ({ company: co, staff_id: r.staff_id, day, mark: unpaid ? 'A' : 'L', note: `${r.leave_type} leave ${TAG}`, entered_by: me, updated_at: new Date().toISOString() }));
      if (rows.length) { const { error } = await s.upsert(rows, { onConflict: 'staff_id,day' }); if (error) throw error; }
    } else if (days.length) {
      const { error } = await s.delete().eq('staff_id', r.staff_id).in('day', days).like('note', `%${TAG}`);
      if (error) throw error;
    }
  }

  async function decide(r, status) {
    let note = '';
    if (status === 'rejected') { note = window.prompt('Reason for rejecting (optional)', '') ?? null; if (note === null) return; }
    setBusy(true); setMsg('');
    try {
      if (status === 'approved') await marks(r, true);
      if (r.status === 'approved' && status !== 'approved') await marks(r, false);
      const { error } = await sb().from('leave_requests').update({
        status, decided_by: status === 'pending' ? null : me, decided_at: status === 'pending' ? null : new Date().toISOString(),
        decision_note: note || null, updated_at: new Date().toISOString()
      }).eq('id', r.id);
      if (error) throw error;
      setMsg(status === 'approved' ? '✓ Approved. The days are marked in Attendance.' : status === 'rejected' ? '✓ Rejected' : '✓ Back to pending. Attendance marks taken out.');
      load();
    } catch (err) { setMsg(err.message || String(err)); }
    setBusy(false);
  }

  async function remove(r) {
    if (!window.confirm(`Delete this leave request of ${person(r.staff_id)?.name || 'employee'}?${r.status === 'approved' ? ' Its Attendance marks are taken out too.' : ''}`)) return;
    withEditPassword(async () => {
      try {
        if (r.status === 'approved') await marks(r, false);
        const { error } = await sb().from('leave_requests').delete().eq('id', r.id);
        if (error) throw error;
        setMsg('✓ Deleted'); load();
      } catch (err) { setMsg(err.message || String(err)); }
    });
  }

  const counts = useMemo(() => (list || []).reduce((m, r) => ({ ...m, [r.status]: (m[r.status] || 0) + 1 }), {}), [list]);
  const onLeave = (list || []).filter((r) => r.status === 'approved' && r.date_from <= today && r.date_to >= today);
  const annual = useMemo(() => {
    const m = {};
    (list || []).filter((r) => r.status === 'approved' && r.leave_type === 'Annual' && String(r.date_from).startsWith(year)).forEach((r) => { m[r.staff_id] = (m[r.staff_id] || 0) + Number(r.days || 0); });
    return m;
  }, [list, year]);
  const shown = (list || []).filter((r) => !filter || r.status === filter);

  if (pick.keys === null) return <p className="muted">Loading...</p>;

  return (
    <>
      <h1>🌴 Leave requests{C ? ` · ${C.short}` : ''}</h1>
      <p className="sub">{C ? C.name : 'Choose a company'} · request, approve, and the days go into Attendance by themselves</p>
      <CoBar pick={pick} />

      {!co ? <p className="empty">Choose a company above.</p> : (
        <>
          {msg && <p className="muted qm-msg">{msg}</p>}
          <div className="qm-boxes">
            <div className="panel"><small>Waiting for approval</small><b>{counts.pending || 0}</b></div>
            <div className="panel"><small>On leave today</small><b>{onLeave.length}</b><span className="muted">{onLeave.map((r) => person(r.staff_id)?.name).filter(Boolean).join(', ') || ' '}</span></div>
            <div className="panel"><small>Approved</small><b>{counts.approved || 0}</b></div>
          </div>

          <div className="page-tools"><div className="tools">
            {canAdd && <button type="button" className="btn" onClick={() => withEditPassword(() => setForm(blank()))} disabled={!staff.length}>＋ New leave request</button>}
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Status">
              <option value="pending">Pending ({counts.pending || 0})</option>
              <option value="approved">Approved ({counts.approved || 0})</option>
              <option value="rejected">Rejected ({counts.rejected || 0})</option>
              <option value="">All ({(list || []).length})</option>
            </select>
            <Link href={`/personnel?tab=attendance&co=${co}`} className="btn ghost">📅 Attendance</Link>
          </div></div>
          {!staff.length && list !== null && <p className="empty">No employees in {C?.short} yet. Add them in Employees first.</p>}
          {!canDecide && <p className="muted qm-note">Only Full access users can approve or reject.</p>}

          {form && (
            <form className="panel qm-form" onSubmit={save}>
              <h3>{form.id ? 'Edit leave request' : '＋ New leave request'}</h3>
              <div className="qm-grid">
                <label className="qm-wide">Employee<select value={form.staff_id} onChange={(e) => setF('staff_id', e.target.value)} required>
                  <option value="">Choose...</option>
                  {staff.map((p) => <option key={p.id} value={p.id}>{p.name}{p.designation ? ` · ${p.designation}` : ''}</option>)}
                </select></label>
                <label>Type<select value={form.leave_type} onChange={(e) => setF('leave_type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
                <label>From<input type="date" value={form.date_from} onChange={(e) => setF('date_from', e.target.value)} required /></label>
                <label>To<input type="date" value={form.date_to} min={form.date_from} onChange={(e) => setF('date_to', e.target.value)} required /></label>
                <label className="qm-wide">Reason<input value={form.reason || ''} onChange={(e) => setF('reason', e.target.value)} /></label>
              </div>
              <p className="muted qm-note">
                {formDays} working {formDays === 1 ? 'day' : 'days'} ({person(form.staff_id)?.staff_type === 'Site' ? 'Friday off' : 'Friday and Saturday off'})
                {form.staff_id && form.leave_type === 'Annual' ? ` · Annual leave used in ${year}: ${annual[form.staff_id] || 0} of ${ANNUAL_DAYS}` : ''}
                {form.leave_type === 'Unpaid' ? ' · Unpaid: marked Absent, so it comes off the salary' : ''}
              </p>
              <div className="qm-btns">
                <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving...' : '✓ Save'}</button>
                <button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
              </div>
            </form>
          )}

          {list === null ? <p className="muted">Loading...</p> : shown.length === 0 ? (
            <p className="empty">{filter === 'pending' ? 'Nothing waiting for approval.' : 'No leave requests here.'}</p>
          ) : (
            <div className="table-wrap"><table>
              <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th className="num">Days</th><th>Reason</th><th>Status</th><th /></tr></thead>
              <tbody>
                {shown.map((r) => {
                  const p = person(r.staff_id);
                  const [label, cls] = STATUS[r.status] || STATUS.pending;
                  return (
                    <tr key={r.id}>
                      <td><b>{p?.name || 'Employee removed'}</b>{r.leave_type === 'Annual' && <small className="muted"><br />Annual used {annual[r.staff_id] || 0}/{ANNUAL_DAYS}</small>}</td>
                      <td>{r.leave_type}</td>
                      <td>{fmtDate(r.date_from)}</td>
                      <td>{fmtDate(r.date_to)}</td>
                      <td className="num">{Number(r.days)}</td>
                      <td>{r.reason}{r.decision_note ? <small className="muted"><br />Note: {r.decision_note}</small> : null}</td>
                      <td><span className={`pill ${cls}`}>{label}</span><small className="muted"><br />{r.decided_by ? `by ${r.decided_by}` : r.requested_by ? `asked by ${r.requested_by}` : ''}</small></td>
                      <td className="qm-act">
                        {canDecide && r.status === 'pending' && <button type="button" className="btn" disabled={busy} onClick={() => decide(r, 'approved')}>✅ Approve</button>}
                        {canDecide && r.status === 'pending' && <button type="button" className="btn ghost" disabled={busy} onClick={() => decide(r, 'rejected')}>✗ Reject</button>}
                        {canDecide && r.status !== 'pending' && <button type="button" className="btn ghost" disabled={busy} onClick={() => decide(r, 'pending')}>↶ Undo</button>}
                        {canAdd && r.status === 'pending' && <button type="button" className="btn ghost" onClick={() => withEditPassword(() => setForm({ ...r }))}>✏️</button>}
                        {user.canDelete && <button type="button" className="btn ghost" onClick={() => remove(r)}>🗑</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
          {C && <p style={{ marginTop: 14 }}><Link href={`/company/${C.key}`}>‹ Back to {C.short}</Link></p>}
        </>
      )}
    </>
  );
}

export default function Page() {
  return <AuthGate><Leave /></AuthGate>;
}
