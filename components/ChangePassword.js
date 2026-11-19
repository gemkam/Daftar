'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import { sb } from '@/lib/supabase';

/*
  🔑 Change my password (Owner, 9 Nov 2026): the office gives every user a username and a default password
  with the link; the user can change his own password here (account menu in the top bar, and the driver bar).
  Checks the current password first, new password at least 6 characters, typed twice.
*/
export default function ChangePassword({ username, onClose }) {
  const [cur, setCur] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 30); return () => clearTimeout(t); }, []);

  async function save(e) {
    e.preventDefault();
    setErr('');
    if (!cur) { setErr('Type your current password.'); return; }
    if (p1.length < 6) { setErr('The new password must have at least 6 letters or numbers.'); return; }
    if (p1 !== p2) { setErr('The two new passwords are not the same.'); return; }
    if (p1 === cur) { setErr('The new password is the same as the current one.'); return; }
    setBusy(true);
    const s = sb();
    const { data: me } = await s.auth.getUser();
    const email = me?.user?.email || `${username}@daftar.local`;
    // check the current password (signs in again as the same user)
    const chk = await s.auth.signInWithPassword({ email, password: cur });
    if (chk.error) { setBusy(false); setErr('Current password is wrong.'); return; }
    const { error } = await s.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
  }

  const type = show ? 'text' : 'password';
  return (
    <Modal title="🔑 Change my password" onClose={onClose}>
      {done ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <p style={{ margin: 0 }}>✅ Your password is changed. Use the new password next time you log in.</p>
          <div className="modal-actions"><button type="button" className="btn in" onClick={onClose}>OK</button></div>
        </div>
      ) : (
        <form onSubmit={save} className="cp-form">
          <p className="muted" style={{ margin: 0 }}>Username: <b>{username}</b></p>
          <label><span>Current password</span>
            <input ref={ref} className="drv-input" type={type} autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
          </label>
          <label><span>New password</span>
            <input className="drv-input" type={type} autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
          </label>
          <label><span>New password again</span>
            <input className="drv-input" type={type} autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
          </label>
          <label className="cp-show"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
          {err && <div className="error">{err}</div>}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn in" disabled={busy}>{busy ? 'Saving...' : 'Change password'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
