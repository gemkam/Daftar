'use client';

import { useEffect, useState } from 'react';
import { COMPANIES } from '@/lib/expenses';
import { myCompanyKeys, isCompanyUnlocked, unlockCompany } from '@/lib/companyAccess';

/*
  🏢 Company switch for one-company pages (CRM, Quotations, Leave requests, 27 Nov 2026).
  Same rules as Petty cash: only his companies, each asks its password once, ?co= in the address.
*/
export const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const r3 = (n) => Math.round(Number(n || 0) * 1000) / 1000;
export const todayISO = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10); // Muscat
export const addDays = (iso, d) => { const t = new Date(`${iso}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
export const CO_CODE = { 'al-noor': 'AN', sahil: 'SH', 'ali-pack': 'AP' };

export function useCoPick(user, path) {
  const [keys, setKeys] = useState(null);
  const [co, setCo] = useState('');
  const [ask, setAsk] = useState(null);
  useEffect(() => { myCompanyKeys(user).then(setKeys).catch(() => setKeys([])); }, [user]);
  const list = keys === 'all' ? COMPANIES : COMPANIES.filter((c) => (keys || []).includes(c.key));

  function choose(k) {
    if (!isCompanyUnlocked(k)) { setAsk(COMPANIES.find((c) => c.key === k) || null); return; }
    setCo(k);
    try {
      const q = new URLSearchParams(window.location.search);
      q.set('co', k);
      window.history.replaceState(null, '', `${path}?${q.toString()}`);
      localStorage.setItem('tudo-exp-co', k);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (keys === null) return;
    let k = '';
    try { k = new URLSearchParams(window.location.search).get('co') || localStorage.getItem('tudo-exp-co') || ''; } catch { /* ignore */ }
    if (list.some((c) => c.key === k)) choose(k);
    else if (list.length === 1) choose(list[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  function opened() {
    if (!ask) return;
    unlockCompany(ask.key);
    const k = ask.key;
    setAsk(null);
    choose(k);
  }

  return { keys, list, co, choose, ask, setAsk, opened, company: COMPANIES.find((c) => c.key === co) || null };
}
