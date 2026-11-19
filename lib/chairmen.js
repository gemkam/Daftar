/*
  👑 Chairman (6 Nov 2026, Owner): top bar button before Admin. Inside: one button per chairman.
  - Khalid Nasser: full access, the whole app, all companies (login "khalid").
  - Salim: no access yet. Owner will add another company later and give him access to that company only.
  username = the login name (Users page). Empty = no login yet.
  approvals: true = has the ✅ Approvals button (bills Faisal verified). Only Khalid Nasser (6 Nov 2026).
  companies: 'all' = every company, [] = none yet, later e.g. ['new-company-key'].
*/
export const CHAIRMEN = [
  { key: 'khalid', name: 'Khalid Nasser', username: 'khalid', companies: 'all', approvals: true },
  // 13 Nov 2026 (Owner): Salim is the co-chairman; approves the bills of his companies (same as Company access)
  { key: 'salim', name: 'Salim', username: 'salim', companies: ['sahil'], approvals: true, co: true }
];

export const chairmanOf = (key) => CHAIRMEN.find((c) => c.key === key) || null;
export const chairmanForUser = (user) => CHAIRMEN.find((c) => c.username && c.username === user?.username) || null;
/* Administrator sees every chairman; a chairman sees only his own button */
export const canSeeChairman = (user) => !!(user?.isOwner || chairmanForUser(user));
export const canOpenChairman = (user, key) => !!(user?.isOwner || chairmanForUser(user)?.key === key);
/* Bill verifiers (13 Nov 2026, Owner): Faisal (Administrator) verifies every company, Ali Pack included; Hamad also verifies Ali Pack.
   Same rule in the database (guard_bill_verify). */
export const BILL_VERIFIERS = { hamad: ['sahil'] };
export const canVerifyBill = (user, company) => !!(user?.isOwner || (BILL_VERIFIERS[user?.username] || []).includes(company));
export const verifierName = (company) => (company === 'sahil' ? 'Faisal / Hamad' : 'Faisal'); // Faisal is everywhere (Owner 13 Nov 2026)
export const chairmanCovers = (c, company) => !!c && (c.companies === 'all' || (c.companies || []).includes(company));
export const hasAccess = (c) => c.companies === 'all' || (Array.isArray(c.companies) && c.companies.length > 0);
