'use client';

import { COMPANIES } from '@/lib/expenses';
import { LEVELS, pagesOfCompany } from '@/lib/pageAccess';

/*
  🔑 Access per company (Owner 11 Nov 2026), under "Which company?" in Create users / Users / 🏢 Companies.
  Each chosen company: "Whole company" (his access level on every page, as before) or "Choose pages" with
  No access / View only / Data entry / Full access for each page. value = { company: null | { pageKey: level } }.
*/
export default function CompanyPagesPick({ keys, value, onChange, role }) {
  const list = (keys || []).filter((k) => k !== '*');
  if (!list.length) return null;
  const v = value || {};
  const set = (k, pages) => onChange({ ...v, [k]: pages });
  const maxLabel = { viewer: 'View only', entry: 'Data entry', editor: 'Full access' }[role] || '';
  return (
    <div className="cpp">
      <b className="cpp-h">🔑 What can he open in each company?</b>
      {list.map((k) => {
        const c = COMPANIES.find((x) => x.key === k);
        const pages = v[k] && typeof v[k] === 'object' ? v[k] : null;
        return (
          <div key={k} className="cpp-co">
            <div className="cpp-top">
              <b>{c?.short || k}</b>
              <select value={pages ? 'pages' : 'whole'} onChange={(e) => set(k, e.target.value === 'pages' ? {} : null)} aria-label={`Access in ${c?.short || k}`}>
                <option value="whole">Whole company{maxLabel ? ` (${maxLabel})` : ''}</option>
                <option value="pages">Choose pages</option>
              </select>
            </div>
            {pages && (
              <div className="cpp-pages">
                {pagesOfCompany(k).map(([pk, label]) => (
                  <label key={pk} className={`cpp-row${pages[pk] ? ' on' : ''}`}>
                    <span>{label}</span>
                    <select value={pages[pk] || ''} onChange={(e) => { const n = { ...pages }; if (e.target.value) n[pk] = e.target.value; else delete n[pk]; set(k, n); }}>
                      {LEVELS.map(([lv, l]) => <option key={lv} value={lv}>{l}</option>)}
                    </select>
                  </label>
                ))}
                {maxLabel && <small className="muted">A page never gets more than his access level ({maxLabel}).</small>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
