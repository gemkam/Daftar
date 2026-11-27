'use client';

import { useEffect, useState } from 'react';
import LangSwitch from '@/components/LangSwitch';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase';
import PwInput from '@/components/PwInput';

// Usernames are mapped to internal login emails, e.g. "Nasser" -> nasser@daftar.local
const DOMAIN = '@daftar.local';

// What a visitor sees under the login box (27 Nov 2026, Kamran: show every module, not only 6)
const FEATURES = [
  ['🧾', 'Invoices and VAT', 'Fawtara-ready e-invoice, QR, Arabic and English, VAT return'],
  ['📝', 'Quotations', 'Quote, PDF, WhatsApp, convert to invoice'],
  ['🤝', 'Customers (CRM)', 'Leads, follow-ups, sales pipeline'],
  ['💵', 'Bills and approvals', 'AI reads bills, verify, chairman approval'],
  ['📒', 'Expenses and petty cash', 'By department, monthly balance'],
  ['🏦', 'Accounts', 'Bank and cash, profit and loss, balance sheet'],
  ['👥', 'Employees', 'Papers, attendance, leave requests'],
  ['💰', 'Salary', 'Salary sheets and slips sent to staff'],
  ['📦', 'Inventory', 'Stock in and out, low stock alerts'],
  ['🚚', 'Transport', 'Trips, drivers, vehicles, maintenance'],
  ['📋', 'Documents', 'CR, visas and cards with expiry alerts'],
  ['🤖', 'AI assistant', 'Ask about bills, salary and totals']
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(false); // came here after Logout

  useEffect(() => {
    try { setOut(new URLSearchParams(window.location.search).get('out') === '1'); } catch { /* ignore */ }
    sb().auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
    });
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const name = username.trim().toLowerCase().replace(/\s+/g, '');
    if (!name) return;
    setBusy(true);
    const { error } = await sb().auth.signInWithPassword({ email: name + DOMAIN, password });
    setBusy(false);
    if (error) {
      setError('Username or password is wrong. Please check and try again.');
      return;
    }
    router.replace('/');
  }

  return (
    <div className="login">
      <LangSwitch className="login-lang" />
      <form className="login-card panel" onSubmit={submit}>
        <h1>Daftar Office System</h1>
        {out && <div className="logout-note">✅ You have logged out. Nothing is shown until you log in again.</div>}
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" autoComplete="username" autoCapitalize="none" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. Administrator" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <PwInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
        <p className="login-alt">New to Daftar? <Link href="/signup">Create an account</Link></p>
        <p className="login-alt" style={{ marginTop: 6 }}><Link href="/change-password">🔑 Change password</Link></p>
      </form>
      <section className="login-feat" aria-label="What is in Daftar">
        <h2>Everything your office needs, in one app</h2>
        <ul>
          {FEATURES.map(([ico, t, d]) => <li key={t}><span aria-hidden="true">{ico}</span><b>{t}</b><small>{d}</small></li>)}
        </ul>
        <p className="muted">Several companies in one login · English and Arabic · Works on phone and computer</p>
      </section>
    </div>
  );
}
