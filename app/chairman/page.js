'use client';

import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import { CHAIRMEN, hasAccess } from '@/lib/chairmen';
import { canSeeLeadStaff, canEnterLead } from '@/lib/leadStaff';

/* 👑 Chairman (6 Nov 2026): one button per chairman (lib/chairmen.js) */
function ChairmanPage() {
  const user = useUser();
  const list = canSeeLeadStaff(user) ? CHAIRMEN : [];
  const sub = (c) => `${c.co ? 'Deputy General Manager' : 'General Manager'} · ${c.companies === 'all' ? 'Full access · All companies' : hasAccess(c) ? 'Full access' : 'No access yet'}`;
  return (
    <>
      <h1>👑 General Manager</h1>
      <p className="sub">Daftar general managers.</p>
      {list.length === 0 ? <p className="empty">This page is only for the general managers and the Administrator.</p> : (
        <div className="adm-grid">
          {list.map((c) => (canEnterLead(user, c.username) ? (
            <Link key={c.key} href={`/chairman/${c.key}`} className="adm-tile">
              <span className="adm-ico" aria-hidden="true">👑</span>
              <span className="adm-tx"><b>{c.name}</b><small>{sub(c)}</small></span>
              <span className="adm-go" aria-hidden="true">›</span>
            </Link>
          ) : (
            <div key={c.key} className="adm-tile" aria-disabled="true" style={{ opacity: 0.6, cursor: 'default' }} title={`Only ${c.name} can open this`}>
              <span className="adm-ico" aria-hidden="true">👑</span>
              <span className="adm-tx"><b>{c.name}</b><small>{sub(c)}</small><small>🔒 Only {c.name} can open</small></span>
            </div>
          )))}
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <AuthGate><ChairmanPage /></AuthGate>;
}
