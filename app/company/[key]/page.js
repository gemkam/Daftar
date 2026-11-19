'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { noPasswordCompany } from '@/lib/editLock';
import AuthGate, { useUser } from '@/components/AuthGate';
import CompanyLock from '@/components/CompanyLock';
import { COMPANIES } from '@/lib/expenses';
import { myCompanyKeys, isCompanyUnlocked, unlockCompany, lockCompany, companyPages } from '@/lib/companyAccess';
import { loadMyPages, allowedTiles } from '@/lib/pageAccess';

/* 🏢 One company (9 Nov 2026, Owner): opened from its button in All Companies (/expenses) after the password.
   Everything of that company in one place: bills, invoices, expense sheet, salary, employees, attendance,
   VAT return, accounts, reports, documents (and Transport for Al Noor). Each page keeps its own
   buttons and 🖨 Print with column choice. Only users given this company (Admin › Company access) or Administrators. */
function CompanyHome() {
  const { key } = useParams();
  const user = useUser();
  const router = useRouter();
  const [allowed, setAllowed] = useState(null);
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState(null); // 🔑 his pages in this company (lib/pageAccess.js)
  useEffect(() => { loadMyPages(user).then(setMine).catch(() => setMine({})); }, [user]);
  const c = COMPANIES.find((x) => x.key === key);

  useEffect(() => {
    myCompanyKeys(user).then((k) => setAllowed(k === 'all' || k.includes(key))).catch(() => setAllowed(false));
    setOpen(isCompanyUnlocked(key));
  }, [user, key]);

  if (!c) return <p className="empty">Company not found. <Link href="/expenses">Back to All Companies</Link></p>;
  if (allowed === null) return <p className="muted">Loading...</p>;
  if (!allowed) return <p className="empty">You have no access to {c.short}. Ask the Administrator. <Link href="/expenses">Back to All Companies</Link></p>;
  if (!open) {
    return (
      <div style={{ margin: '30px auto', maxWidth: 400 }}>
        <CompanyLock inline company={c} onOpen={() => { unlockCompany(key); setOpen(true); }} onCancel={() => router.push('/expenses')} />
      </div>
    );
  }

  return (
    <>
      <div className="company-head ch-top cmp-head">
        {c.logo ? <span className="cmp-logo"><img src={c.logo} alt="" /></span> : <span className="cmp-ico" aria-hidden="true">🏢</span>}
        <div>
          <h1>{c.short}</h1>
          <p className="sub">{c.name}{c.cr ? ` · ${c.cr}` : ''}{c.address ? ` · ${c.address}` : ''}</p>
        </div>
        {!noPasswordCompany(key) && <button type="button" className="btn ghost cmp-lock" onClick={() => { lockCompany(key); router.push('/expenses'); }}>🔒 Lock and close</button>}
      </div>
      <div className="adm-grid">
        {allowedTiles(key, companyPages(key), mine, user).map(([href, ico, label, sub]) => (
          <Link key={href} href={href} className="adm-tile">
            <span className="adm-ico" aria-hidden="true">{ico}</span>
            <span className="adm-tx"><b>{label}</b><small>{sub}</small></span>
            <span className="adm-go" aria-hidden="true">›</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function Page() {
  return <AuthGate><CompanyHome /></AuthGate>;
}
