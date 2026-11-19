/*
  👤 Faisal (11 Nov 2026, Owner): Faisal has full hold of the whole app (Administrator, bill verifier),
  and gets his OWN interface: top bar button "Faisal" -> /faisal, showing every company (Al Noor,
  Sahil + added companies) with all its pages: bills, invoices, reports & summary,
  accounts and the rest. Seen by Faisal's login (username "faisal") and the Administrators (same rule as Chairman).
*/
export const FAISAL = { username: 'faisal', name: 'Faisal' };
export const isFaisal = (user) => !!user?.username && user.username === FAISAL.username;
export const canSeeFaisal = (user) => !!(user?.isOwner || isFaisal(user));
