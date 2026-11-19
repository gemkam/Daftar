'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LangSwitch from '@/components/LangSwitch';
import { sb } from '@/lib/supabase';

/*
  🙋 Sign up (19 Nov 2026, Kamran): anyone makes his own login (RPC public_signup, database/09_self_signup.sql).
  He then lands on Home, which shows only ＋ Add company. Logins are username@daftar.local like the others.
*/
const DOMAIN = '@daftar.local';

export default function SignupPage() {
  const router = useRouter();
  const [f, setF] = useState({ name: '', username: '', password: '', again: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    sb().auth.getSession().then(({ data }) => { if (data.session) router.replace('/'); });
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const username = f.username.trim().toLowerCase().replace(/\s+/g, '');
    if (f.name.trim().length < 2) { setError('Type your full name.'); return; }
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) { setError('Username must be 3 to 30 letters or numbers, no spaces.'); return; }
    if (f.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (f.password !== f.again) { setError('The two passwords are not the same.'); return; }
    setBusy(true);
    const { error: e1 } = await sb().rpc('public_signup', { p_username: username, p_password: f.password, p_display: f.name.trim() });
    if (e1) { setBusy(false); setError(e1.message || 'Could not create the account. Please try again.'); return; }
    const { error: e2 } = await sb().auth.signInWithPassword({ email: username + DOMAIN, password: f.password });
    setBusy(false);
    if (e2) { setError('Account created. Please log in.'); router.replace('/login'); return; }
    router.replace('/');
  }

  return (
    <div className="login">
      <LangSwitch className="login-lang" />
      <form className="login-card panel" onSubmit={submit}>
        <h1>Create your account</h1>
        <p className="muted" style={{ margin: '0 0 10px' }}>Then add your company and start using Daftar.</p>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label htmlFor="su-name">Full name</label>
          <input id="su-name" autoComplete="name" required value={f.name} onChange={set('name')} placeholder="e.g. Ahmed Al Balushi" />
        </div>
        <div className="field">
          <label htmlFor="su-user">Username</label>
          <input id="su-user" autoComplete="username" autoCapitalize="none" required value={f.username} onChange={set('username')} placeholder="e.g. ahmed" />
        </div>
        <div className="field">
          <label htmlFor="su-pw">Password</label>
          <input id="su-pw" type="password" autoComplete="new-password" required value={f.password} onChange={set('password')} placeholder="At least 6 characters" />
        </div>
        <div className="field">
          <label htmlFor="su-pw2">Password again</label>
          <input id="su-pw2" type="password" autoComplete="new-password" required value={f.again} onChange={set('again')} />
        </div>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button>
        <p className="login-alt">Already have an account? <Link href="/login">Log in</Link></p>
      </form>
    </div>
  );
}
