import { sb } from '@/lib/supabase';
import { noPasswordCompany } from '@/lib/editLock';
import { COMPANIES } from '@/lib/expenses';
import { BOOKS, bookHref } from '@/lib/wbTabs';

/*
  🏢 Company buttons in Admin (Owner, 9 Nov 2026).
  - One button per company (the 3 fixed ones + every ＋ Added company, e.g. Test).
  - Each button asks the password (same 728300, no Enter needed), then opens /company/<key>.
  - The Administrator gives users access to any company: table company_access (user_id, company).
    Administrators always have every company. Others see only the companies given to them.
  - Unlocked companies are kept for this browser tab only (sessionStorage), so going back to the
    company page from Bills, Salary etc. does not ask again. Pressing the button in Admin always asks.
*/

const KEY = 'tudo-co-unlocked';

export function isCompanyUnlocked(key) {
  if (noPasswordCompany(key)) return true; // Ali Pack, Barq Express: no company password (Owner 11 Nov 2026)
  try { return JSON.parse(sessionStorage.getItem(KEY) || '[]').includes(key); } catch { return false; }
}
export function unlockCompany(key) {
  try {
    const s = new Set(JSON.parse(sessionStorage.getItem(KEY) || '[]'));
    s.add(key);
    sessionStorage.setItem(KEY, JSON.stringify([...s]));
  } catch { /* ignore */ }
}
export function lockCompany(key) {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || '[]').filter((k) => k !== key);
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

/* '*' in company_access = All companies, also companies added later (Owner 11 Nov 2026) */
export const ALL_CO = '*';

/* company keys this user may open ('all' for Administrators and users given All companies) */
export async function myCompanyKeys(user) {
  if (!user) return [];
  if (user.isOwner) return 'all';
  const { data } = await sb().from('company_access').select('company').eq('user_id', user.id);
  const keys = (data || []).map((r) => r.company);
  return keys.includes(ALL_CO) ? 'all' : keys;
}

/* Administrator: { userId: [company keys] } */
export async function accessByUser() {
  const rows = await loadAllAccess();
  const m = {};
  rows.forEach((r) => { (m[r.user_id] ||= []).push(r.company); });
  return m;
}

/* Administrator: set exactly these companies for one user (['*'] = All companies) */
export async function saveUserCompanies(userId, keys, by, pagesMap) {
  const want = (keys || []).includes(ALL_CO) ? [ALL_CO] : [...new Set(keys || [])];
  const { data, error } = await sb().from('company_access').select('company').eq('user_id', userId);
  if (error) throw error;
  const have = (data || []).map((r) => r.company);
  const drop = have.filter((k) => !want.includes(k));
  const add = want.filter((k) => !have.includes(k));
  if (drop.length) {
    const { error: e1 } = await sb().from('company_access').delete().eq('user_id', userId).in('company', drop);
    if (e1) throw e1;
  }
  if (add.length) {
    const { error: e2 } = await sb().from('company_access').insert(add.map((company) => ({ user_id: userId, company, given_by: by || null })));
    if (e2 && e2.code !== '23505') throw e2;
  }
  // 🔑 access per page (lib/pageAccess.js): null = whole company
  if (pagesMap) {
    for (const k of want) {
      const pages = pagesMap[k] && typeof pagesMap[k] === 'object' ? pagesMap[k] : null;
      const { error: e3 } = await sb().from('company_access').update({ pages }).eq('user_id', userId).eq('company', k);
      if (e3) throw e3;
    }
  }
}

/* Administrator: { userId: { company: pages | null } } */
export async function pagesByUser() {
  const { data, error } = await sb().from('company_access').select('user_id, company, pages');
  if (error) throw error;
  const m = {};
  (data || []).forEach((r) => { (m[r.user_id] ||= {})[r.company] = r.pages || null; });
  return m;
}

export function companiesFor(keys) {
  if (keys === 'all') return COMPANIES;
  return COMPANIES.filter((c) => (keys || []).includes(c.key));
}

/* Administrator: every access row */
export async function loadAllAccess() {
  const { data, error } = await sb().from('company_access').select('user_id, company');
  if (error) throw error;
  return data || [];
}

export async function setAccess(userId, company, on, by) {
  if (on) {
    const { error } = await sb().from('company_access').insert({ user_id: userId, company, given_by: by || null });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await sb().from('company_access').delete().eq('user_id', userId).eq('company', company);
    if (error) throw error;
  }
}

/* the pages of one company (Owner: everything of that company in one place) */
export function companyPages(key) {
  // 5th item = page key for access per page (lib/pageAccess.js, Owner 11 Nov 2026)
  const list = [
    ['/expenses/docs?co=K&kind=receipt', '🧾', 'Bills', 'Bills paid, 📥 Import documents, 📷 Take photo, AI check, Verify', 'bills'],
    ['/expenses/docs?co=K&kind=invoice', '📄', 'Invoices', 'Our invoices with the company letterhead', 'invoices'],
    ['/expenses?co=K', '📒', 'Expense sheet', 'All bills and expenses of the company, by department, Excel / PDF', 'expenses'],
    ['/expenses/petty?co=K', '💵', 'Petty cash', 'Cash received and spent, balance by month, Print, Excel', 'petty'],
    ['/expenses/salary?co=K', '💰', 'Salary', 'Monthly salary slips, approve, salary paid', 'salary'],
    ['/personnel?tab=office&co=K', '👥', 'Employees', 'Office and site employees, papers, send slip to employee', 'employees'],
    ['/personnel?tab=attendance&co=K', '📅', 'Attendance', 'Attendance sheet, present by default', 'attendance'],
    ['/expenses/vat?co=K', '🧾', 'VAT return', 'Output and input VAT by quarter or month', 'vat'],
    ['/accounts?co=K', '🏦', 'Accounts', 'Bank and cash, balance sheet, money to receive and pay', 'accounts'],
    ['/expenses/summary?co=K', '📊', 'Reports & Summary', 'This company only: budgets, cash flow, Profit and Loss, Analytics', 'summary'],
    ['/docs?tab=company&co=K', '📋', 'Documents Checklist', 'Company papers and their expiry dates', 'docs']
  ];
  // 🦁 Ali Pack (11 Nov 2026): one button per Excel file, FIRST (before Bills, Owner 11 Nov 2026); inside it, its tabs are buttons with their tables
  if (key === 'ali-pack') list.unshift(...BOOKS.map((b) => [bookHref(b.key), b.ico, b.title, `Excel file: ${b.tabs.join(', ')}`, 'books']));
  // 📦 own Inventory (Owner 11 Nov 2026, lib/inventoryCo.js)
  list.push(['/inventory?co=K', '📦', 'Inventory', 'This company\'s own stock: sections, items, stock log, bills, reports', 'inventory']);
  if (key === 'al-noor') list.push(['/transport', '🚚', 'Transport', 'Trip sheets, drivers, vehicles, salary sheets', 'transport'], ['/entry', '🧑‍✈️', 'Drivers data entry', 'Driver trip form, new trips, papers, trip complete, links for drivers', 'transport']);
  return list.map(([h, ...r]) => [h.replace(/co=K/, `co=${key}`).replace(/^\/inventory\?co=K$/, `/inventory?co=${key}`), ...r]);
}
