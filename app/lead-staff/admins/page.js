'use client';

import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import { adminsFor, canEnterLead } from '@/lib/leadStaff';

/* 🛡 Admins (11 Nov 2026, Owner): Faisal (his own interface /faisal, as it was) and Hamad (/lead-staff/admins/hamad) */
function AdminsPage() {
  const user = useUser();
  const list = adminsFor(user);
  return (
    <>
      <h1>🛡 Secretaries</h1>
      <p className="sub">Bill verifiers and app administrators.</p>
      {list.length === 0 ? <p className="empty">This page is only for the secretaries and the Administrator.</p> : (
        <div className="adm-grid">
          {list.map((a) => a.href && canEnterLead(user, a.username) ? (
            <Link key={a.key} href={a.href} className="adm-tile">
              <span className="adm-ico" aria-hidden="true">👤</span>
              <span className="adm-tx"><b>{a.name}</b><small>{a.sub}</small></span>
              <span className="adm-go" aria-hidden="true">›</span>
            </Link>
          ) : (
            <div key={a.key} className="adm-tile" aria-disabled="true" style={{ opacity: 0.6, cursor: 'default' }} title={`Only ${a.name} can open this`}>
              <span className="adm-ico" aria-hidden="true">👤</span>
              <span className="adm-tx"><b>{a.name}</b><small>{a.sub}</small><small>🔒 Only {a.name} can open</small></span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <AuthGate><AdminsPage /></AuthGate>;
}
