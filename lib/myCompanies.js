'use client';

import { useEffect, useState } from 'react';
import { COMPANIES } from '@/lib/expenses';
import { myCompanyKeys } from '@/lib/companyAccess';

/*
  Only my companies in every company list of the app (Owner 13 Nov 2026: "Hamad should see only his companies.
  Do the same thing for everyone."): pills, drop-downs, side buttons, tabs.
  Administrators (Faisal, Khalid, Owner) and users given All companies ('*', Nasser) get every company.
  Everyone else gets the companies ticked for him in Company access (Hamad, Salim: Ali Pack, Barq Express).
  The database already blocks other companies' data (supabase/company-lock.sql); this only cleans up the lists.
  Pass the user (from useUser) so this file does not need components/AuthGate.
*/
const cache = new Map(); // user id -> Promise of keys

export function loadMyKeys(user) {
  if (!user) return Promise.resolve([]);
  if (user.isOwner) return Promise.resolve('all');
  if (!cache.has(user.id)) cache.set(user.id, myCompanyKeys(user).catch(() => { cache.delete(user.id); return []; }));
  return cache.get(user.id);
}

export const mineOnly = (list, keys) => (keys === 'all' ? list : (list || []).filter((c) => (keys || []).includes(c.key || c)));

/* keys: 'all' | [keys] | null while loading */
export function useMyCompanyKeys(user) {
  const [keys, setKeys] = useState(user?.isOwner ? 'all' : null);
  useEffect(() => {
    let live = true;
    loadMyKeys(user).then((k) => { if (live) setKeys(k); });
    return () => { live = false; };
  }, [user?.id, user?.isOwner]); // eslint-disable-line react-hooks/exhaustive-deps
  return keys;
}

/* the companies of `list` (default all companies) that this user has */
export function useMyCompanies(user, list = COMPANIES) {
  const keys = useMyCompanyKeys(user);
  return keys === null ? [] : mineOnly(list, keys);
}

/*
  Owner 13 Nov 2026 (second message): the other companies stay in the list but GREYED and cannot be clicked.
  Every company of `list`, each with mine: true/false. Use: disabled={!c.mine}, className 'co-off'.
*/
export function useCompanyChoices(user, list = COMPANIES) {
  const keys = useMyCompanyKeys(user);
  return (list || []).map((c) => ({ ...c, mine: keys === 'all' || (Array.isArray(keys) && keys.includes(c.key)) }));
}
