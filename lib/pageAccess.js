import { sb } from '@/lib/supabase';
import { companyPages } from '@/lib/companyAccess';

/*
  🔑 Access per company page (Owner 11 Nov 2026). Create users / Users / 🏢 Companies:
  for each company either "Whole company" (company_access.pages = null: his access level everywhere in it, as before)
  or "Choose pages": every page of the company (Bills, Invoices, Expense sheet, Petty cash, Salary, Employees,
  Attendance, VAT, Accounts, Reports, Documents, Inventory ...) gets No access / View only / Data entry / Full access.
  company_access.pages = { pageKey: 'viewer' | 'entry' | 'editor' } (missing key = no access).
  AuthGate (pageGate) blocks a page he has no access to, and lowers his level on that page to the page's level
  (never higher than his own access level). The company page shows only his pages.
  Pages that show all companies together (no ?co=) open with the best level he has for that page in any company.
*/

export const LEVELS = [['', 'No access'], ['viewer', 'View only'], ['entry', 'Data entry'], ['editor', 'Full access']];
const RANK = { driver: -1, viewer: 0, entry: 1, editor: 2, admin: 3 };
const lower = (a, b) => (RANK[a] <= RANK[b] ? a : b);
const higher = (a, b) => (!a ? b : !b ? a : RANK[a] >= RANK[b] ? a : b);

/* [pageKey, label] of one company, in the order of its company page */
export function pagesOfCompany(key) {
  const seen = new Set(); const out = [];
  for (const p of companyPages(key)) {
    const k = p[4];
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push([k, k === 'books' ? 'Excel files (Quotations, Running Accounts)' : k === 'transport' ? 'Transport and Drivers data entry' : p[2]]);
  }
  return out;
}

/* which company page this address is */
export function pageKeyOf(path, sp) {
  const kind = sp.get('kind'); const tab = sp.get('tab');
  if (path === '/expenses/docs') return kind === 'invoice' ? 'invoices' : 'bills';
  if (path === '/expenses') return 'expenses';
  if (path.startsWith('/expenses/petty')) return 'petty';
  if (path.startsWith('/expenses/crm')) return 'crm';
  if (path.startsWith('/expenses/quotes')) return 'quotes';
  if (path.startsWith('/expenses/leave')) return 'leave';
  if (path.startsWith('/expenses/salary')) return 'salary';
  if (path.startsWith('/expenses/vat')) return 'vat';
  if (path.startsWith('/expenses/summary')) return 'summary';
  if (path.startsWith('/expenses/attendance')) return 'attendance';
  if (path === '/personnel') return tab === 'attendance' ? 'attendance' : 'employees';
  if (path.startsWith('/accounts')) return 'accounts';
  if (path === '/docs') return 'docs';
  if (['/inventory', '/inventory/reports', '/bills', '/log'].includes(path) && sp.get('co')) return 'inventory';
  if (path.startsWith('/transport') || path === '/entry') return 'transport';
  if (path.startsWith('/alipack')) return 'books';
  return '';
}

function coOf(pk, sp) {
  const co = sp.get('co') || '';
  if (co && co !== 'all') return co;
  if (pk === 'transport') return 'al-noor';
  if (pk === 'books') return 'ali-pack';
  return '';
}

let cache = null; // { id, promise }
/* this user's rows: { company: pages | null } */
export function loadMyPages(user) {
  if (!user?.id) return Promise.resolve({});
  if (cache && cache.id === user.id) return cache.promise;
  const promise = sb().from('company_access').select('company, pages').eq('user_id', user.id)
    .then(({ data, error }) => {
      if (error) return {};
      const m = {};
      (data || []).forEach((r) => { m[r.company] = r.pages && typeof r.pages === 'object' ? r.pages : null; });
      return m;
    });
  cache = { id: user.id, promise };
  return promise;
}
export const clearMyPages = () => { cache = null; };

/* null = nothing to change; { block: text } or { role } */
export function pageGate(user, mine, path, search) {
  if (!user || user.isOwner || user.isEntry || !mine) return null;
  const sp = new URLSearchParams(search || '');
  const pk = pageKeyOf(path, sp);
  if (!pk) return null;
  const co = coOf(pk, sp);
  const rows = Object.entries(mine);
  if (!rows.length || rows.every(([, p]) => p === null)) return null; // whole companies only: as before
  if (co) {
    const p = co in mine ? mine[co] : mine['*'];
    if (p === undefined || p === null) return null; // no access is handled by the company gates; whole company = as before
    const lv = p[pk];
    if (!lv) return { block: 'You have no access to this page of this company. Ask the Administrator.' };
    return { role: lower(user.role, lv) };
  }
  // page with every company together: best level he has for it anywhere
  let best = '';
  for (const [, p] of rows) best = higher(best, p === null ? user.role : p[pk] || '');
  if (!best) return { block: 'You have no access to this page. Ask the Administrator.' };
  return { role: lower(user.role, best) };
}

/* company page tiles he may open */
export function allowedTiles(key, list, mine, user) {
  if (!user || user.isOwner || !mine) return list;
  const p = key in mine ? mine[key] : mine['*'];
  if (!p) return list;
  return list.filter((t) => !t[4] || p[t[4]]);
}
