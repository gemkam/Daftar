import { COMPANIES, companyOf } from '@/lib/expenses';

/*
  Own inventory per company (Owner 11 Nov 2026): Ali Pack and Barq Express each have a separate inventory
  (own sections, items, stock log, bills, reports). categories.company / bill_accounts.company = company key;
  empty (null) = the first shared Inventory, unchanged. Pages take ?co=<key> (/inventory, /bills, /log, /inventory/reports);
  a section page (/c/<id>) knows its company from the section.
*/
/* 13 Nov 2026 (Owner): every company has its own inventory (Al Noor, Sahil copied from the
   main inventory: same sections, item names, units, minimums and bill accounts, stock starting at 0).
   Companies added later (Admin) also get one; it starts empty (＋ New section). */
export const invCompanies = () => COMPANIES.map((c) => c.key);
export const INV_COMPANIES = invCompanies(); // the five built-in companies (kept for older imports)

export function invCoFromUrl() {
  if (typeof window === 'undefined') return '';
  const k = new URLSearchParams(window.location.search).get('co') || '';
  return /^[a-z0-9-]+$/.test(k) ? k : '';
}

export const coQ = (co) => (co ? `?co=${co}` : '');
export const byCo = (q, co) => (co ? q.eq('company', co) : q.is('company', null));
export const invHome = (co) => `/inventory${coQ(co)}`;
export const invTitle = (co) => (co ? `Inventory · ${companyOf(co)?.short || co}` : 'Inventory');
