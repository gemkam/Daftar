'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import { COMPANIES } from '@/lib/expenses';
import { companyPages } from '@/lib/companyAccess';
import { FAISAL } from '@/lib/faisal';
import { canEnterLead } from '@/lib/leadStaff';

/* 👤 Faisal's own interface (11 Nov 2026, Owner).
   Switch at the top: 📊 All companies (complete combined report) + one button per company.
   A company = all its pages (bills, invoices, expense sheet, salary, employees, attendance, VAT, accounts,
   reports & summary, documents). The switch is kept in the link (?co=) and on this device, so coming back
   from any page opens the same company. Each company page keeps its own password (no change). */
const MEM = 'tudo-faisal-co';

const ALL = [
  ['/expenses/summary', '📊', 'Complete report', 'All companies and Transport combined: budgets, cash flow, Profit and Loss, Analytics, VAT'],
  ['/expenses/docs?kind=invoice', '📄', 'Invoices', 'Pick a company, then switch company with the buttons at the top: each company shows its own invoices'],
  ['/accounts', '🏦', 'Accounts', 'All companies: bank and cash, balance sheet, money to receive and pay'],
  ['/personnel?tab=office', '👥', 'Employees and staff', 'All companies: office, drivers, site employees, subcontractors'],
  ['/personnel?tab=attendance', '📅', 'Attendance', 'Attendance sheets of every company'],
  ['/expenses/vat', '🧾', 'VAT return', 'Output and input VAT of all companies and Transport'],
  ['/transport', '🚚', 'Transport', 'Trip sheets, drivers, vehicles, salary sheets'],
  ['/docs?tab=company', '📋', 'Documents Checklist', 'Papers and expiry dates of every company'],
  ['/chairman/khalid/approvals', '✅', 'Approvals', 'Bills verified, waiting for the chairman, approved, rejected']
];

function Tiles({ list }) {
  return (
    <div className="adm-grid">
      {list.map(([href, ico, label, sub]) => (
        <Link key={href} href={href} className="adm-tile">
          <span className="adm-ico" aria-hidden="true">{ico}</span>
          <span className="adm-tx"><b>{label}</b><small>{sub}</small></span>
          <span className="adm-go" aria-hidden="true">›</span>
        </Link>
      ))}
    </div>
  );
}

function FaisalPage() {
  const user = useUser();
  const [co, setCo] = useState('all');

  useEffect(() => {
    let k = '';
    try { k = new URLSearchParams(window.location.search).get('co') || localStorage.getItem(MEM) || ''; } catch { /* ignore */ }
    if (k === 'all' || COMPANIES.some((c) => c.key === k)) setCo(k);
  }, []);

  function pick(k) {
    setCo(k);
    try { localStorage.setItem(MEM, k); window.history.replaceState(null, '', `/faisal?co=${k}`); } catch { /* ignore */ }
  }

  if (!canEnterLead(user, FAISAL.username)) return <p className="empty">🔒 This page is only for {FAISAL.name}.</p>;
  const c = COMPANIES.find((x) => x.key === co);

  return (
    <>
      <h1>👤 {FAISAL.name}</h1>
      <p className="sub">Administrator · Bill verifier · Full access · All companies ({COMPANIES.length})</p>

      <div className="co-switch rf-switch" role="tablist" aria-label="Company">
        <button type="button" role="tab" aria-selected={co === 'all'} className={co === 'all' ? 'on' : ''} onClick={() => pick('all')}>📊 All companies</button>
        {COMPANIES.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={co === x.key} className={co === x.key ? 'on' : ''} onClick={() => pick(x.key)}>{x.short}</button>
        ))}
      </div>
      {/* 🛠 Faisal's own button, not inside All companies (Owner 11 Nov 2026) */}
      <div className="adm-grid" style={{ marginBottom: 14 }}>
        <Link href="/system-admin-activity" className="adm-tile">
          <span className="adm-ico" aria-hidden="true">🛠</span>
          <span className="adm-tx"><b>System Administrator Activity</b><small>What Owner did, day by day and time-wise, since the first day</small></span>
          <span className="adm-go" aria-hidden="true">›</span>
        </Link>
      </div>
      <div>
        <Link href={`/expenses/petty?co=${co}`} className="btn rf-petty">💵 Petty cash · {c ? c.short : 'All companies'}</Link>
      </div>

      {!c ? (
        <section className="rf-co">
          <h2 className="rf-h">All companies together · complete report</h2>
          <p className="sub">Combined information of {COMPANIES.map((x) => x.short).join(', ')} and Transport. Bills, expense sheet and salary open per company: pick a company above.</p>
          <Tiles list={ALL} />
        </section>
      ) : (
        <section className="rf-co">
          <div className="company-head cmp-head rf-co-head">
            {c.logo ? <span className="cmp-logo"><img src={c.logo} alt="" /></span> : <span className="cmp-ico" aria-hidden="true">🏢</span>}
            <div>
              <h2>{c.short}</h2>
              <p className="sub">{c.name}{c.cr ? ` · ${c.cr}` : ''}</p>
            </div>
            <Link href={`/company/${c.key}`} className="btn ghost rf-open">↗ Open company</Link>
          </div>
          <Tiles list={companyPages(c.key)} />
        </section>
      )}
    </>
  );
}

export default function Page() {
  return <AuthGate><FaisalPage /></AuthGate>;
}
