'use client';

import Link from 'next/link';
import AuthGate from '@/components/AuthGate';
import AlertsPanel from '@/components/AlertsPanel';

/* 🔔 Alerts (19 Nov 2026, Owner): Android / iOS top bar button before Admin.
   Everything that was in the Home alarm clock (alerts, double work) plus the Documents Checklist. */
function AlertsPage() {
  return (
    <div className="al-page-wrap">
      <h1>🔔 Alerts</h1>
      <p className="sub">Payments, renewals, maintenance and documents that need attention. <Link href="/docs">📋 Documents Checklist</Link></p>
      <AlertsPanel page />
    </div>
  );
}

export default function Page() {
  return <AuthGate><AlertsPage /></AuthGate>;
}
