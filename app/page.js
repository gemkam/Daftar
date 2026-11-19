'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import { COMPANIES } from '@/lib/expenses';
import { companyPages } from '@/lib/companyAccess';
import TruckAnim from '@/components/TruckAnim';
import AlertsPanel from '@/components/AlertsPanel';
import HomeSearch from '@/components/HomeSearch';
import { IntroReplayButton } from '@/components/IntroSplash';
import { sb, isLow } from '@/lib/supabase';

function Letterhead() {
  return (
    <span className="hub-letterhead">
      <img src="/daftar-logo.png" alt="Daftar" />
      <span className="hub-co">
        <b>Al Noor Logistics and Trading LLC</b>
        <span>CR No. 1000001 · VAT Registration No. OM1100000001</span>
        <span>P.O. Box 100, PC 112, Ruwi, Muscat, Sultanate of Oman</span>
      </span>
    </span>
  );
}

function Home() {
    const [inv, setInv] = useState(null);
  const [tr, setTr] = useState(null);
  const [ex, setEx] = useState(null);

  useEffect(() => {
    (async () => {
      const s = sb();
      const [c, d, e, x] = await Promise.all([
        s.from('categories').select('id, name, items(quantity, min_qty)').order('sort'),
        s.from('transport_drivers').select('id, name').order('sort'),
        s.from('transport_entries').select('entry_date').order('entry_date', { ascending: false }).limit(1),
        s.from('exp_entries').select('entry_date, paid')
      ]);
      const cats = c.data || [];
      const items = cats.flatMap((x) => x.items || []);
      setInv({ sections: cats.map((x) => x.name), items: items.length, low: items.filter(isLow).length });
      setTr({ drivers: (d.data || []).map((y) => y.name), last: e.data?.[0]?.entry_date || null });
      const ex2 = x.data || [];
      const lastMonth = ex2.map((r) => String(r.entry_date).slice(0, 7)).sort().pop();
      setEx({ bills: ex2.length, month: lastMonth, paid: ex2.filter((r) => String(r.entry_date).startsWith(lastMonth || '-')).reduce((t, r) => t + Number(r.paid || 0), 0) });
    })();
  }, []);

  return (
    <>
      <div className="home-hero">
        <span className="home-kicker">Al Noor · Sahil</span>
        <h1 className="center">Daftar Office System</h1>
        <span className="home-rule" aria-hidden="true"><i /></span>
        <IntroReplayButton />
      </div>
      <HomeSearch />
      <div className="home-grid">
      <div className="home-main">
      <div className="hub">
        <Link href="/inventory" className="hub-tile">
          <Letterhead />
          <span className="hub-kicker">Office</span>
          <span className="hub-title">Inventory</span>
          <span className="hub-sub">
            {inv ? `${[...inv.sections, 'Bills'].join(' · ')}` : 'Office supplies · Kitchen · Sanitary · Bills'}
          </span>
          <span className="hub-meta">
            {inv ? <>{inv.items} {inv.items === 1 ? "item" : "items"}{inv.low > 0 && <b className="hub-alert">{inv.low} low</b>}</> : ' '}
          </span>
        </Link>
        <Link href="/transport" className="hub-tile">
          <Letterhead />
          <span className="hub-kicker">Transport Division</span>
          <span className="hub-title-row">
            <span className="hub-title">Transport Expense</span>
            <TruckAnim />
          </span>
          <span className="hub-sub">Trips · Diesel · Tolls · Maintenance · Salaries</span>
          <span className="hub-meta">
            {tr ? <>{tr.drivers.length} drivers{tr.drivers.length > 0 && `: ${tr.drivers.join(', ')}`}</> : ' '}
          </span>
        </Link>
        <Link href="/expenses" className="hub-tile">
          <span className="hub-brand brand-anim" role="img" aria-label="Daftar">
            <img className="ba-base" src="/brand-base.png" alt="" />
            <img className="ba-swap" src="/brand-text-swap.png" alt="" />
            <img className="ba-arrow" src="/brand-arrow.png" alt="" />
          </span>
          <span className="hub-kicker">Al Noor · Sahil · Transport</span>
          <span className="hub-title">All Companies</span>
          <span className="hub-sub">Bills · Salary · Petrol · Utility · VAT · 🚚 Trips &amp; Diesel</span>
          <span className="hub-meta">
            {ex ? (ex.bills ? <>{ex.bills} bills · {ex.month ? new Date(`${ex.month}-01T00:00:00`).toLocaleString('en-GB', { month: 'long' }) : ''}: {ex.paid.toFixed(3)} OMR</> : 'No bills yet') : ' '}
          </span>
        </Link>
      </div>
      </div>
      <AlertsPanel />
      </div>
      <div className="powered-by" aria-label="Powered by KS TECH LLC">Powered by <b>KS TECH LLC</b></div>
    </>
  );
}

/* 🙋 Signed up user (19 Nov 2026, Kamran): Home shows only ＋ Add company until he adds one.
   Then his company's full grid (Bills, Salary, Employees, Accounts, Reports & Summary, Inventory ...).
   COMPANIES already holds only his own companies (components/AuthGate.js keepCompanies). */
const selfTiles = (key) => companyPages(key).filter((t) => t[4] !== 'docs' && t[4] !== 'transport');

function SelfHome() {
  const user = useUser();
  const mine = COMPANIES;
  const first = (user.name || '').split(' ')[0];
  return (
    <>
      <div className="home-hero">
        <span className="home-kicker">{mine.length ? mine.map((c) => c.short).join(' · ') : 'Welcome'}</span>
        <h1 className="center">Daftar Office System</h1>
        <span className="home-rule" aria-hidden="true"><i /></span>
      </div>
      {mine.length === 0 && !user.isCoOwner && <p className="empty">No company is given to you yet. Ask your company owner.</p>}
      {mine.length === 0 && user.isCoOwner && (
        <div className="self-start">
          <p className="self-hi">Welcome{first ? `, ${first.charAt(0).toUpperCase()}${first.slice(1)}` : ''}. Start by adding your company.</p>
          <Link href="/add-company" className="self-add big">
            <span className="self-plus" aria-hidden="true">＋</span>
            <span><b>Add company</b><small>Owner details, CR number and company details. Then all the pages open for your company.</small></span>
          </Link>
        </div>
      )}
      {mine.map((c) => (
        <section key={c.key} className="self-co">
          <Link href={`/company/${c.key}`} className="company-head cmp-head self-co-head">
            {c.logo ? <span className="cmp-logo"><img src={c.logo} alt="" /></span> : <span className="cmp-ico" aria-hidden="true">🏢</span>}
            <div>
              <h2>{c.short}</h2>
              <p className="sub">{c.name}{c.cr ? ` · ${c.cr}` : ''}</p>
            </div>
          </Link>
          {mine.length === 1 && (
            <div className="adm-grid">
              {selfTiles(c.key).map(([href, ico, label, sub]) => (
                <Link key={href} href={href} className="adm-tile">
                  <span className="adm-ico" aria-hidden="true">{ico}</span>
                  <span className="adm-tx"><b>{label}</b><small>{sub}</small></span>
                  <span className="adm-go" aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}
      {mine.length > 0 && user.isTeamAdmin && (
        <Link href="/team" className="self-add">
          <span className="self-plus" aria-hidden="true">👥</span>
          <span><b>Users</b><small>Make logins for your staff: Manager, Accountant, HR Manager ... and choose what each can do.</small></span>
        </Link>
      )}
      {mine.length > 0 && user.isCoOwner && (
        <Link href="/add-company" className="self-add">
          <span className="self-plus" aria-hidden="true">＋</span>
          <span><b>Add another company</b><small>Each company has its own bills, salary, employees and inventory.</small></span>
        </Link>
      )}
      <div className="powered-by" aria-label="Powered by KS TECH LLC">Powered by <b>KS TECH LLC</b></div>
    </>
  );
}

function HomeSwitch() {
  const user = useUser();
  return user.isSelf ? <SelfHome /> : <Home />;
}

export default function Page() {
  return <AuthGate wide><HomeSwitch /></AuthGate>;
}
