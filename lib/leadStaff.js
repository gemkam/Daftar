/*
  ⭐ Lead Staff (11 Nov 2026, Owner): top bar button (was "Chairman"). Inside two buttons:
  - 👑 Chairman -> /chairman (Khalid Nasser and Salim, lib/chairmen.js)
  - 🛡 Admins   -> /lead-staff/admins (Faisal and Hamad)
  Faisal's own interface (/faisal) moved here as it is: Lead Staff › Admins › Faisal (no top bar Faisal button any more).
  Hamad (11 Nov 2026): login "hamad", Full access, companies Sahil (Company access); his page /lead-staff/admins/hamad.
  username = the login name (Users page). Empty = no login yet. href = his page ('' = no page yet).
*/
import { CHAIRMEN } from '@/lib/chairmen';
import { canSeeFaisal } from '@/lib/faisal';

export const ADMINS = [
  { key: 'faisal', name: 'Faisal', username: 'faisal', href: '/faisal', sub: 'Administrator · Bill verifier · All companies' },
  { key: 'hamad', name: 'Hamad', username: 'hamad', href: '/lead-staff/admins/hamad', sub: 'Bill verifier · Full access · Sahil', companies: ['sahil'] }
];

/*
  13 Nov 2026 (Owner): every lead staff member (chairmen Khalid Nasser, Salim and admins Faisal, Hamad) SEES all the
  Lead Staff buttons (Chairman and Admins, every name), but can ENTER only his own button (his own login).
  An Administrator who is not lead staff (Owner) can still enter every button.
*/
export const LEAD_USERNAMES = [...CHAIRMEN.map((c) => c.username), ...ADMINS.map((a) => a.username)].filter(Boolean);
export const isLeadStaff = (user) => !!user?.username && LEAD_USERNAMES.includes(user.username);
export const canSeeLeadStaff = (user) => !!(user?.isOwner || isLeadStaff(user));
export const canEnterLead = (user, username) => !!user && (user.username === username || (!!user.isOwner && !isLeadStaff(user)));
export const canSeeAdmins = canSeeLeadStaff;
export const adminsFor = (user) => (canSeeLeadStaff(user) ? ADMINS : []);
/* kept for older imports */
export const canSeeFaisalPage = canSeeFaisal;
