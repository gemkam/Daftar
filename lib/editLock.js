/*
  Edit password (1 Nov 2026): every Edit button asks for the edit password once; then editing stays open until
  ✓ Done (lockEdit) or another page is opened (AuthGate locks again on page change).
  Only the SHA-256 of the password is kept here. This is a lock against changes by mistake, not real security:
  who may change data is still decided by the access level (Users page / database rules).
*/
const HASH = '7353fcc007f672472639e4f64e78bee10444912a846ccc9b14221dc0170aa5ce';
let unlocked = false;

/*
  11 Nov 2026 (Owner): no passwords for Ali Pack and Barq Express (no company password, no edit password there;
  only the login password of each user). The Admin password is asked ONCE per browser tab: after that, Admin pages and
  their buttons do not ask again (sessionStorage "tudo-admin-ok", cleared on Logout).
*/
export const NO_PW_COMPANIES = ['ali-pack', 'barq-express'];
export const noPasswordCompany = (key) => NO_PW_COMPANIES.includes(key);
const ADMIN_KEY = 'tudo-admin-ok';
const ADMIN_PATHS = ['/admin', '/settings', '/users', '/activity'];
const inAdmin = (p) => ADMIN_PATHS.some((a) => p === a || p.startsWith(`${a}/`));
export function isAdminOpen() { try { return sessionStorage.getItem(ADMIN_KEY) === '1'; } catch { return false; } }
export function openAdmin() { try { sessionStorage.setItem(ADMIN_KEY, '1'); } catch { /* ignore */ } }
export function closeAdmin() { try { sessionStorage.removeItem(ADMIN_KEY); } catch { /* ignore */ } }

/* true on a page of Ali Pack / Barq Express, or on an Admin page after the Admin password */
export function noPasswordHere() {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  if (inAdmin(p) && isAdminOpen()) return true;
  if (p.startsWith('/alipack')) return true;
  const seg = p.split('/');
  if (seg[1] === 'company' && noPasswordCompany(seg[2])) return true;
  const co = new URLSearchParams(window.location.search).get('co') || '';
  return noPasswordCompany(co);
}

export const isEditUnlocked = () => unlocked || noPasswordHere();
export function lockEdit() { unlocked = false; }

/* true when the text is the password; does NOT open editing (used by the Admin lock) */
export async function isRightPassword(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text || '').trim()));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === HASH;
}

export async function checkEditPassword(text) {
  if (await isRightPassword(text)) { unlocked = true; return true; }
  return false;
}

/* resolves true when the password is right (or already unlocked), false when cancelled */
export function requestEditPassword() {
  if (unlocked || typeof window === 'undefined') return Promise.resolve(true);
  if (noPasswordHere()) { unlocked = true; return Promise.resolve(true); }
  return new Promise((resolve) => window.dispatchEvent(new CustomEvent('tudo-edit-password', { detail: resolve })));
}

/* run fn only after the password */
export async function withEditPassword(fn) {
  if (await requestEditPassword()) fn();
}
