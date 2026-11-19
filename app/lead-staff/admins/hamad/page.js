'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import { COMPANIES } from '@/lib/expenses';
import { companyPages, myCompanyKeys, companiesFor } from '@/lib/companyAccess';
import { ADMINS, canEnterLead } from '@/lib/leadStaff';

/* 👤 Hamad's page (11 Nov 2026, Owner): Lead Staff › Admins › Hamad. Bill verifier, Full access, his companies
   (Sahil). One button per company at the top, then all that company's pages.
   Hamad sees the companies of his own login (Company access); the Administrator sees the list in lib/leadStaff.js. */
const HAMAD = ADMINS.find((a) => a.key === 'hamad');

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

function AliPage() {
  const user = useUser();
  const me = user?.username === HAMAD.username;
  const [cos, setCos] = useState(null);
  const [co, setCo] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      const list = me ? companiesFor(await myCompanyKeys(user)) : COMPANIES.filter((c) => HAMAD.companies.includes(c.key));
      if (!live) return;
      setCos(list);
      setCo((k) => k || list[0]?.key || '');
    })();
    return () => { live = false; };
  }, [me, user]);

  if (!canEnterLead(user, HAMAD.username)) return <p className="empty">🔒 This page is only for Hamad.</p>;
  if (!cos) return <div className="loading">Loading...</div>;
  const c = cos.find((x) => x.key === co);

  return (
    <>
      <h1>👤 Hamad</h1>
      <p className="sub">Bill verifier · Full access · {cos.map((x) => x.short).join(', ') || 'no company yet'}</p>
      {cos.length > 0 && (
        <div className="co-switch rf-switch" role="tablist" aria-label="Company">
          {cos.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={co === x.key} className={co === x.key ? 'on' : ''} onClick={() => setCo(x.key)}>{x.short}</button>
          ))}
        </div>
      )}
      {c && (
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
  return <AuthGate><AliPage /></AuthGate>;
}
