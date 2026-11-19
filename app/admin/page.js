'use client';

import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import FaisalPicturePanel from '@/components/FaisalPicturePanel';

/*
  Admin hub (31 Oct 2026): one place for the admin tools.
  9 Nov 2026 (Owner): 🏢 Company access is its own page (/admin/companies): user access to companies and every
  company tool (add, edit, remove, backup, delete data). The company buttons themselves are in All Companies.
*/
const TOOLS = [
  ['/admin/staff', '👤', 'Staff data entry', 'Add staff. They go into Employees and the salary sheet of their company', 'owner'],
  ['/admin/create-users', '🔑', 'Create users', 'Login for a driver or staff member from Employees (then give companies in Company access)', 'owner'],
  ['/users', '👥', 'Users', 'Create users, 4 access levels, online now / last seen', 'owner'],
  ['/activity', '👁', 'User activity', 'Logins, pages opened, buttons pressed, every change (old → new)', 'owner'],
  ['/admin/power', '🛠', 'Power Editor', '⚡ One switch: when ON, tap any label, font or photo in the app to change it. OFF = nothing can be changed', 'owner'],
  ['/settings', '⚙️', 'Settings', 'Inventory categories, bills and app settings', 'admin'],
  ['/timeline', '🕒', 'Timeline', 'Everything built and changed in the app, day by day', 'admin'],
  ['/sitemap', '🗺', 'Sitemap', 'Every page of the app as a searchable tree', 'admin'],
  ['/admin/companies', '🏢', 'Company access', 'Users and their companies, add / edit / remove a company, backup and delete company data', 'owner'],
];

function AdminPage() {
  const user = useUser();
  const { isOwner } = user;
  const list = TOOLS.filter((t) => t[4] === 'admin' || isOwner);
  if (user.isEntry) return <p className="empty">This page is not for driver logins.</p>;
  return (
    <>
      <div className="page-tools"><Link href="/" className="crumb">← Home</Link></div>
      <h1>🛡 Admin</h1>
      <p className="sub">Users, company access, activity, settings and other admin tools in one place.</p>
      {isOwner && (
        <>
          <h2 className="adm-h">🧰 Admin tools</h2>
          <div className="adm-grid">
            {list.map(([href, ico, label, sub]) => (
              <Link key={href} href={href} className="adm-tile">
                <span className="adm-ico" aria-hidden="true">{ico}</span>
                <span className="adm-tx"><b>{label}</b><small>{sub}</small></span>
                <span className="adm-go" aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
          <div style={{ marginTop: 22 }}><FaisalPicturePanel /></div>
        </>
      )}
    </>
  );
}

export default function Page() {
  return <AuthGate ownerOnly><AdminPage /></AuthGate>;
}
