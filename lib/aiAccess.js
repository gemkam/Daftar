/*
  🔒 AI Search and the Faisal AI assistant answer ONLY from what this user may open (Owner 11 Nov 2026).
  Read on the server with the user's own login. Administrator = everything. Others: their companies (company_access,
  '*' = all companies) and, when chosen, only the pages ticked for that company (company_access.pages, lib/pageAccess.js).
  Data with no company (shared Inventory, Documents Checklist) follows: shared Inventory = everyone who can read the app,
  Documents Checklist = someone with the Documents page in any company. Transport = Al Noor › Transport.
*/
export async function accessOf(supa, authUser) {
  const role = authUser?.app_metadata?.role || 'viewer';
  if (role === 'admin') return makeAccess(true, {});
  if (role === 'driver') return makeAccess(false, {}, true);
  const { data } = await supa.from('company_access').select('company, pages').eq('user_id', authUser.id);
  const rows = {};
  (data || []).forEach((r) => { rows[r.company] = r.pages && typeof r.pages === 'object' ? r.pages : null; });
  if ('*' in rows && rows['*'] === null) return makeAccess(true, rows);
  return makeAccess(false, rows);
}

function makeAccess(all, rows, nothing = false) {
  const can = (co, page) => {
    if (nothing) return false;
    if (all) return true;
    const p = co in rows ? rows[co] : rows['*'];
    if (p === undefined) return false;
    if (p === null) return true;
    return !!p[page];
  };
  const canAny = (page) => !nothing && (all || Object.values(rows).some((p) => p === null || !!p?.[page]));
  return { all, nothing, can, canAny, transport: can('al-noor', 'transport') };
}

/* filter the whole-app data of lib/appWatch.js */
export function filterWatch(D, A) {
  if (A.all) return D;
  const coOk = (co, ...pages) => pages.some((pg) => A.can(co, pg));
  const accOk = new Set((D.accounts || []).filter((a) => !a.company || A.can(a.company, 'inventory')).map((a) => a.id));
  return {
    ...D,
    exp: (D.exp || []).filter((r) => coOk(r.company, 'expenses', 'bills')),
    te: A.transport ? D.te : [], ts: A.transport ? D.ts : [], drv: A.transport ? D.drv : [],
    veh: A.transport ? D.veh : [], maint: A.transport ? D.maint : [],
    docs: (D.docs || []).filter((r) => coOk(r.company, r.kind === 'invoice' ? 'invoices' : 'bills')),
    budgets: (D.budgets || []).filter((b) => (b.source === 'transport' ? A.transport : coOk(b.source, 'summary', 'expenses'))),
    cats: (D.cats || []).filter((c) => !c.company || A.can(c.company, 'inventory')),
    accounts: (D.accounts || []).filter((a) => accOk.has(a.id)),
    bills: (D.bills || []).filter((b) => accOk.has(b.account_id)),
    staff: (D.staff || []).filter((s) => coOk(s.company, 'employees', 'salary', 'attendance')),
    checklist: A.canAny('docs') ? D.checklist : []
  };
}

/* filter lib/assistant.js inventoryData */
export function filterInventory(I, A) {
  if (A.all) return I;
  const cats = (I.cats || []).filter((c) => !c.company || A.can(c.company, 'inventory'));
  const items = new Set(cats.flatMap((c) => (c.items || []).map((i) => i.id)));
  return {
    cats,
    moves: (I.moves || []).filter((m) => items.has(m.item_id)),
    bills: (I.bills || []).filter((b) => !b.bill_accounts?.company || A.can(b.bill_accounts.company, 'inventory'))
  };
}

export const emptyTransport = { drivers: [], entries: [], salaries: [], extras: [] };
