'use client';

import AuthGate, { useUser } from '@/components/AuthGate';
import TimelineView from '@/components/TimelineView';

/* 🛠 System Administrator Activity (Owner 11 Nov 2026): what Owner did, from the first day to today, day by day and
   time-wise (build steps + his own logins, pages, buttons, changes). For Faisal and Khalid Nasser (and every Administrator,
   because the activity logs can only be read by Administrators). Button in Lead Staff and on Faisal's page. */
function SysAdminActivity() {
  const user = useUser();
  if (!user?.isOwner) return <p className="empty">This page is only for Faisal, Khalid Nasser and the Administrator.</p>;
  return <TimelineView sysadmin />;
}

export default function Page() {
  return <AuthGate><SysAdminActivity /></AuthGate>;
}
