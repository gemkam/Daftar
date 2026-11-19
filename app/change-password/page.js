'use client';

import { useState } from 'react';
import Link from 'next/link';
import LangSwitch from '@/components/LangSwitch';
import { sb } from '@/lib/supabase';
import PwInput from '@/components/PwInput';

/*
  🔑 Change password without opening the app (19 Nov 2026, Kamran): link on the login page.
  Username + current password + new password twice. Signs in, changes the password, signs out again.
  (Inside the app: account menu › 🔑 Change my password, components/ChangePassword.js.)
  Forgot the password? Logins have no email, so the company owner (👥 Users) or the Administrator sets a new one.
*/
const DOMAIN = '@daftar.local';

export default function ChangePasswordPage() {
  const [f, setF] = useState({ username: '', cur: '', p1: '', p2: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const name = f.username.trim().toLowerCase().replace(/\s+/g, '');
    if (!name) { setErr('Type your username.'); return; }
    if (!f.cur) { setErr('Type your current password.'); return; }
    if (f.p1.length < 6) { setErr('The new password must have at least 6 letters or numbers.'); return; }
    if (f.p1 !== f.p2) { setErr('The two new passwords are not the same.'); return; }
    if (f.p1 === f.cur) { setErr('The new password is the same as the current one.'); return; }
    setBusy(true);
    const s = sb();
    const { error: e1 } = await s.auth.signInWithPassword({ email: name + DOMAIN, password: f.cur });
    if (e1) { setBusy(false); setErr('Username or current password is wrong.'); return; }
    const { error: e2 } = await s.auth.updateUser({ password: f.p1 });
    try { await s.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
    setBusy(false);
    if (e2) { setErr(e2.message || 'Could not change the password. Please try again.'); return; }
    setDone(true);
  }

  return (
    <div className="login">
      <LangSwitch className="login-lang" />
      <form className="login-card panel" onSubmit={submit}>
        <h1>🔑 Change password</h1>
        {done ? (
          <>
            <div className="logout-note">✅ Your password is changed. Log in with the new password.</div>
            <Link href="/login" className="btn" style={{ textAlign: 'center' }}>Go to Log in</Link>
          </>
        ) : (
          <>
            {err && <div className="error">{err}</div>}
            <div className="field"><label htmlFor="cp-u">Username</label>
              <input id="cp-u" autoComplete="username" autoCapitalize="none" required value={f.username} onChange={set('username')} /></div>
            <div className="field"><label htmlFor="cp-c">Current password</label>
              <PwInput id="cp-c" autoComplete="current-password" required value={f.cur} onChange={set('cur')} /></div>
            <div className="field"><label htmlFor="cp-1">New password</label>
              <PwInput id="cp-1" autoComplete="new-password" required value={f.p1} onChange={set('p1')} placeholder="At least 6 characters" /></div>
            <div className="field"><label htmlFor="cp-2">New password again</label>
              <PwInput id="cp-2" autoComplete="new-password" required value={f.p2} onChange={set('p2')} /></div>
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Changing...' : 'Change password'}</button>
            <p className="login-alt">Forgot your password? Ask your company owner or the Administrator to set a new one.</p>
          </>
        )}
        <p className="login-alt"><Link href="/login">Back to Log in</Link></p>
      </form>
    </div>
  );
}
