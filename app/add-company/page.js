'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import { sb } from '@/lib/supabase';

/*
  ＋ Add company (19 Nov 2026, Kamran): a signed up user registers his own company.
  Owner details + company details, saved by RPC add_my_company (database/09_self_signup.sql),
  which also gives the company to him only (company_access). Then the full company grid opens.
  The Administrator sees every company; nobody else sees this one.
*/
const LEGAL = ['LLC (Limited Liability Company)', 'SPC (Sole Partner Company)', 'Sole proprietorship (Establishment)', 'SAOC (Closed Joint Stock)', 'Branch of a foreign company', 'Other'];

function AddCompanyForm() {
  const user = useUser();
  if (user.isSelf && !user.isCoOwner) return <p className="empty">Only the company owner can add a company.</p>;
  return <AddCompanyInner user={user} />;
}

function AddCompanyInner({ user }) {
  const [f, setF] = useState({
    owner_name: user.name ? user.name.charAt(0).toUpperCase() + user.name.slice(1) : '', owner_id_no: '', owner_nationality: '', owner_phone: '',
    name: '', name_ar: '', short: '', legal_type: LEGAL[0], cr: '', cr_expiry: '', vat_no: '', activity: '', phone: '', email: '', address: ''
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setErr('');
    if (!f.owner_name.trim()) { setErr('Type the owner name.'); return; }
    if (!f.owner_id_no.trim()) { setErr('Type the ID card number.'); return; }
    if (!f.name.trim()) { setErr('Type the company name.'); return; }
    if (!f.cr.trim()) { setErr('Type the CR number.'); return; }
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { setErr('The company email does not look right.'); return; }
    setBusy(true);
    const { data, error } = await sb().rpc('add_my_company', { p: f });
    if (error) { setBusy(false); setErr(error.message || 'Could not save. Please try again.'); return; }
    // full reload so every page loads the new company
    window.location.href = `/company/${data}`;
  }

  const inp = (k, label, opt = {}) => (
    <label className={opt.wide ? 'wide' : ''}>
      <span>{label}{opt.req && <em> *</em>}</span>
      <input value={f[k]} onChange={set(k)} type={opt.type || 'text'} placeholder={opt.ph || ''} dir={opt.dir} inputMode={opt.mode} autoComplete="off" required={!!opt.req} />
    </label>
  );

  return (
    <form className="ac-form" onSubmit={save}>
      <div className="home-hero">
        <span className="home-kicker">New company</span>
        <h1 className="center">＋ Add company</h1>
        <span className="home-rule" aria-hidden="true"><i /></span>
      </div>

      <div className="ac-card">
        <h2>👤 Owner details</h2>
        <p>The person who owns or manages the company.</p>
        <div className="ac-grid">
          {inp('owner_name', 'Full name', { req: true, ph: 'As on the ID card' })}
          {inp('owner_id_no', 'ID card / Resident card No.', { req: true, ph: 'e.g. 12345678', mode: 'numeric' })}
          {inp('owner_nationality', 'Nationality', { ph: 'e.g. Omani' })}
          {inp('owner_phone', 'Mobile', { ph: 'e.g. +968 9xxx xxxx', type: 'tel' })}
        </div>
      </div>

      <div className="ac-card">
        <h2>🏢 Company details</h2>
        <p>As written on the Commercial Registration (CR).</p>
        <div className="ac-grid">
          {inp('name', 'Company name (English)', { req: true, ph: 'e.g. AL WAHA TRADING L.L.C', wide: true })}
          {inp('name_ar', 'Company name (Arabic)', { ph: 'e.g. الواحة للتجارة ش.م.م', dir: 'rtl', wide: true })}
          {inp('short', 'Short name (on the buttons)', { ph: 'e.g. Al Waha' })}
          <label>
            <span>Legal type</span>
            <select value={f.legal_type} onChange={set('legal_type')}>{LEGAL.map((l) => <option key={l}>{l}</option>)}</select>
          </label>
          {inp('cr', 'CR number', { req: true, ph: 'e.g. 1234567', mode: 'numeric' })}
          {inp('cr_expiry', 'CR expiry date', { type: 'date' })}
          {inp('vat_no', 'VAT registration No.', { ph: 'e.g. OM1100000000 (if registered)' })}
          {inp('activity', 'Business activity', { ph: 'e.g. Trading, Transport, IT services' })}
          {inp('phone', 'Company phone', { type: 'tel', ph: 'e.g. +968 2xxx xxxx' })}
          {inp('email', 'Company email', { type: 'email', ph: 'e.g. info@company.com' })}
          {inp('address', 'Address', { ph: 'e.g. P.O. Box 100, PC 112, Ruwi, Muscat, Sultanate of Oman', wide: true })}
        </div>
      </div>

      {err && <div className="error">{err}</div>}
      <div className="ac-actions">
        <Link href="/" className="btn ghost">Cancel</Link>
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save and open my company'}</button>
      </div>
      <p className="muted center" style={{ margin: 0 }}>Only you and the Administrator can see this company.</p>
    </form>
  );
}

export default function Page() {
  return <AuthGate adminOnly><AddCompanyForm /></AuthGate>;
}
