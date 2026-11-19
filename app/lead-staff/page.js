'use client';

import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import { canSeeLeadStaff } from '@/lib/leadStaff';

/* ⭐ Lead Staff (11 Nov 2026, Owner): 👑 Chairman (Khalid Nasser, Salim) and 🛡 Admins (Faisal, Hamad) */
function LeadStaffPage() {
  const user = useUser();
  const list = [];
  if (canSeeLeadStaff(user)) {
    list.push(['/chairman', '👑', 'General Manager', 'Khalid Nasser · Salim']);
    list.push(['/lead-staff/admins', '🛡', 'Secretaries', 'Faisal · Hamad']);
  }
  return (
    <>
      <h1>⭐ Lead Staff</h1>
      <p className="sub">Daftar general managers and secretaries.</p>
      {list.length === 0 ? <p className="empty">This page is only for the lead staff and the Administrator.</p> : (
        <div className="adm-grid">
          {list.map(([href, ico, label, sub]) => (
            <Link key={href} href={href} className="adm-tile">
              <span className="adm-ico" aria-hidden="true">{ico}</span>
              <span className="adm-tx"><b>{label}</b><small>{sub}</small></span>
              <span className="adm-go" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <AuthGate><LeadStaffPage /></AuthGate>;
}
