'use client';

import AuthGate from '@/components/AuthGate';
import TimelineView from '@/components/TimelineView';

/* 🕒 Timeline (code in components/TimelineView.js) */
export default function Page() {
  return <AuthGate><TimelineView /></AuthGate>;
}
