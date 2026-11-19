'use client';

import { useCallback, useRef, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import CreateUsers from '@/components/CreateUsers';

/* Admin › 🔑 Create users (9 Nov 2026, Owner; was Data entry › Create users).
   Login for a driver or staff member from Employees; then Admin › Company access gives the companies. */
function CreateUsersPage() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const flash = useCallback((text, kind = 'ok') => {
    setToast({ text, kind }); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  return (
    <div className="ent-page office">
      <h1>🔑 Create users</h1>
      <p className="sub">Make a login for a driver or a staff member from Employees. Then tick his companies in Admin › Company access.</p>
      <CreateUsers flash={flash} onChanged={() => {}} />
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
    </div>
  );
}

export default function Page() {
  return <AuthGate ownerOnly><CreateUsersPage /></AuthGate>;
}
