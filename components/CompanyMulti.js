'use client';

import { useEffect, useRef, useState } from 'react';
import { COMPANIES } from '@/lib/expenses';
import { ALL_CO } from '@/lib/companyAccess';

/*
  🏢 Company drop-down with more than one choice (Owner 11 Nov 2026).
  value = array of company keys, or ['*'] = All companies (also every company added later).
  Used on Create users, Admin › Users (create + edit).
*/
export function companyLabel(keys) {
  const k = keys || [];
  if (k.includes(ALL_CO)) return '🏢 All companies';
  if (!k.length) return '– choose company –';
  return k.map((x) => COMPANIES.find((c) => c.key === x)?.short || x).join(', ');
}

export default function CompanyMulti({ value, onChange, id, disabled, allLocked }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const keys = allLocked ? [ALL_CO] : (value || []);
  const all = keys.includes(ALL_CO);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  function pickAll(on) { onChange(on ? [ALL_CO] : []); }
  function pick(k, on) {
    const base = all ? COMPANIES.map((c) => c.key) : keys.filter((x) => x !== ALL_CO);
    const next = on ? [...base, k] : base.filter((x) => x !== k);
    // every company ticked = All companies
    onChange(COMPANIES.length && COMPANIES.every((c) => next.includes(c.key)) ? [ALL_CO] : next);
  }

  return (
    <div className="cm" ref={box}>
      <button type="button" id={id} className="cm-btn" disabled={disabled || allLocked} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="cm-txt">{allLocked ? '🏢 All companies (Administrator)' : companyLabel(keys)}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="cm-menu" role="listbox" aria-multiselectable="true">
          <label className={`cm-opt cm-all${all ? ' on' : ''}`}>
            <input type="checkbox" checked={all} onChange={(e) => pickAll(e.target.checked)} />
            <span>🏢 All companies</span>
          </label>
          {COMPANIES.map((c) => {
            const on = all || keys.includes(c.key);
            return (
              <label key={c.key} className={`cm-opt${on ? ' on' : ''}`}>
                <input type="checkbox" checked={on} onChange={(e) => pick(c.key, e.target.checked)} />
                <span>{c.short}</span>
              </label>
            );
          })}
          <div className="cm-foot"><button type="button" className="btn small" onClick={() => setOpen(false)}>Done</button></div>
        </div>
      )}
    </div>
  );
}
