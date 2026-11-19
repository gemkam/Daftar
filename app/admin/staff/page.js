'use client';

import { useCallback, useRef, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import NonDrivers from '@/components/NonDrivers';

/* Admin › 👤 Staff data entry (9 Nov 2026, Owner; was Data entry › Staff). Staff come from and go to
   the main Employees list (exp_staff). Who may open which company is set in Admin › Company access. */
function StaffEntry() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const flash = useCallback((text, kind = 'ok') => {
    setToast({ text, kind }); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  return (
    <div className="ent-page office">
      <h1>👤 Staff data entry</h1>
      <p className="sub">Add staff here. They go straight into Employees (Office / Site) and the salary sheet of their company.</p>
      <NonDrivers flash={flash} canAdd />
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
    </div>
  );
}

export default function Page() {
  return <AuthGate ownerOnly><StaffEntry /></AuthGate>;
}
