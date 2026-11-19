'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@/components/AuthGate';
import CompanyLock from '@/components/CompanyLock';
import { COMPANIES } from '@/lib/expenses';
import { myCompanyKeys, companiesFor, isCompanyUnlocked, unlockCompany } from '@/lib/companyAccess';

/*
  🔒 Company gate (Owner, 9 Nov 2026): "All Companies" no longer opens Al Noor (or any company) directly.
  It first shows one button per company; each asks its password, then that company's data opens.
  Used on All Companies (/expenses), Bills / Invoices (/expenses/docs), Salary (/expenses/salary) and,
  through AuthGate, every Transport page (Transport belongs to Al Noor).
  Only companies the user may open (Admin › Company access; Administrators all).
*/

export function useCompanyGate(co) {
  const user = useUser();
  const [keys, setKeys] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { myCompanyKeys(user).then(setKeys).catch(() => setKeys([])); }, [user]);
  const allowed = keys === 'all' || (keys || []).includes(co);
  const ok = !!co && keys !== null && allowed && isCompanyUnlocked(co);
  const unlock = useCallback((k) => { unlockCompany(k); setTick((t) => t + 1); }, []);
  return { ok, keys, allowed, unlock, tick };
}

/* the screen shown instead of the data: company buttons, or the password of the chosen company */
export function CompanyPicker({ co, gate, onPick, title = 'All Companies' }) {
  const [ask, setAsk] = useState(null);
  const { keys, allowed, unlock } = gate;
  // a company is chosen (link / tab) but not unlocked yet: ask its password at once
  useEffect(() => {
    if (co && keys !== null && allowed && !isCompanyUnlocked(co)) setAsk(COMPANIES.find((c) => c.key === co) || null);
  }, [co, keys, allowed]);
  if (keys === null) return <p className="muted">Loading companies...</p>;
  const list = companiesFor(keys);
  const open = (c) => { unlock(c.key); setAsk(null); onPick(c.key); };
  return (
    <div className="cg-wrap">
      <h1>🏢 {title}</h1>
      <p className="sub">Choose a company. Each company opens with its password.</p>
      {co && !allowed && <div className="error">You have no access to {COMPANIES.find((c) => c.key === co)?.short || 'this company'}. Ask the Administrator.</div>}
      {list.length === 0 ? (
        <p className="empty">No company is given to you yet. Ask the Administrator to give you access.</p>
      ) : (
        <div className="adm-grid">
          {list.map((c) => (
            <button key={c.key} type="button" className="adm-tile adm-co" onClick={() => (isCompanyUnlocked(c.key) ? open(c) : setAsk(c))}>
              {c.logo ? <span className="adm-co-logo"><img src={c.logo} alt="" /></span> : <span className="adm-ico" aria-hidden="true">🏢</span>}
              <span className="adm-tx"><b>{c.short}</b><small>{c.name}{c.cr ? ` · ${c.cr}` : ''}</small></span>
              <span className="adm-go" aria-hidden="true">{isCompanyUnlocked(c.key) ? '›' : '🔒'}</span>
            </button>
          ))}
        </div>
      )}
      {ask && <CompanyLock company={ask} onCancel={() => setAsk(null)} onOpen={() => open(ask)} />}
    </div>
  );
}

/* 🚚 Transport and Drivers data entry (/entry) belong to Al Noor: they ask the Al Noor password first (AuthGate) */
export function TransportGate({ children }) {
  const gate = useCompanyGate('al-noor');
  if (gate.keys === null) return <p className="muted">Loading...</p>;
  if (gate.ok) return children;
  const mc = COMPANIES.find((c) => c.key === 'al-noor');
  if (!gate.allowed) return <p className="empty">This page is part of Al Noor. You have no access to Al Noor. Ask the Administrator.</p>;
  return (
    <div style={{ margin: '30px auto', maxWidth: 400 }}>
      <CompanyLock inline company={mc} onOpen={() => gate.unlock('al-noor')}
        onCancel={() => { window.location.href = '/expenses'; }} />
    </div>
  );
}
