'use client';

import { useEffect, useRef, useState } from 'react';
import { isRightPassword } from '@/lib/editLock';

/* 🔒 Company password (Owner, 9 Nov 2026): same password as Edit / Admin.
   The company opens the moment the right password is typed (no Enter needed).
   inline = shown inside the page (company page opened by link) instead of a pop-up. */
export default function CompanyLock({ company, onOpen, onCancel, inline = false }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const ref = useRef(null);
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 30); return () => clearTimeout(t); }, []);

  async function typed(v) {
    setVal(v); setErr('');
    if (v && await isRightPassword(v)) onOpen();
  }
  async function submit(e) {
    e.preventDefault();
    if (await isRightPassword(val)) onOpen();
    else { setErr('Wrong password'); setVal(''); ref.current?.focus(); }
  }

  const box = (
    <div className="card col-box" onClick={(e) => e.stopPropagation()}>
      {company?.logo ? <span className="col-logo"><img src={company.logo} alt="" /></span> : <span className="col-ico" aria-hidden="true">🏢</span>}
      <h2>🔒 {company?.short || 'Company'}</h2>
      <p className="muted">Type the password. {company?.short || 'The company'} opens by itself when it is right.</p>
      <form onSubmit={submit}>
        <input ref={ref} className="drv-input" type="password" inputMode="numeric" autoComplete="off"
          value={val} onChange={(e) => typed(e.target.value)} aria-label={`${company?.short || 'Company'} password`} />
        {err && <div className="error">{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn in">Open</button>
        </div>
      </form>
    </div>
  );
  if (inline) return box;
  return <div className="modal-back col-back" role="dialog" aria-modal="true" onClick={onCancel}>{box}</div>;
}
