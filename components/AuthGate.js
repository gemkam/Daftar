'use client';

import TableCards, { ViewSwitch } from '@/components/TableCards';
import ColumnResize from '@/components/ColumnResize';
import TableFilter from '@/components/TableFilter';
import Breadcrumbs from '@/components/Breadcrumbs';
import TransportSideNav, { showTransportSide } from '@/components/TransportSideNav';
import ExpenseSideNav, { showExpenseSide } from '@/components/ExpenseSideNav';
import { canSeeLeadStaff } from '@/lib/leadStaff';
import PersonnelSideNav, { showPersonnelSide } from '@/components/PersonnelSideNav';
import SideHover from '@/components/SideHover';
import PrintColumns from '@/components/PrintColumns';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { sb, setAppRole } from '@/lib/supabase';
import { loadAddedCompanies } from '@/lib/expenses';
import FaisalAssistant from '@/components/NoorAssistant';
import { FaisalCtx, defaultGreeting } from '@/components/FaisalContext';
import ThemeMenu from '@/components/ThemeMenu';
import OfficeTabs from '@/components/OfficeTabs';
import BackToTop from '@/components/BackToTop';
import EditPasswordHost from '@/components/EditPasswordHost';
import AdminLock, { isAdminArea } from '@/components/AdminLock';
import { TransportGate } from '@/components/CompanyGate';
import ChangePassword from '@/components/ChangePassword';
import LookApplier from '@/components/LookApplier';
import PowerMode from '@/components/PowerMode';
import { lockEdit, isAdminOpen, openAdmin, closeAdmin } from '@/lib/editLock';
import { loadMyPages, clearMyPages, pageGate } from '@/lib/pageAccess';
import { startActivity, logPage, endActivity } from '@/lib/activity';

/*
  Access levels (stored in the user's app_metadata.role):
  admin  = Administrator: everything, plus managing users
  editor = Full access: see and edit everything
  viewer = View only
  entry  = Data entry: sees everything, adds and edits data on every page, cannot delete, no Admin panel
  driver = Driver: only his own Driver trip form (open trips, amounts, papers, Trip complete), nothing else
  (31 Oct 2026: the old Data entry level was split into Data entry and Driver. In code, user.isEntry = the Driver level,
  the one locked to /entry.)
*/
export const ROLES = {
  admin: { label: 'Administrator', short: 'Admin' },
  editor: { label: 'Full access', short: 'Full access' },
  viewer: { label: 'View only', short: 'View only' },
  entry: { label: 'Data entry', short: 'Data entry' },
  driver: { label: 'Driver', short: 'Driver' }
};

const UserCtx = createContext({ isAdmin: false, isOwner: false, role: '', name: '' });

export function useUser() {
  return useContext(UserCtx);
}

function readUser(session) {
  const u = session?.user;
  if (!u) return null;
  const role = u.app_metadata?.role || 'viewer';
  const name = u.user_metadata?.display_name || (u.email || '').split('@')[0];
  return { id: u.id, username: (u.email || '').split('@')[0], name, ...roleFlags(role) };
}

/* what an access level may do (also used for the level of one company page, lib/pageAccess.js) */
function roleFlags(role) {
  return {
    role,
    isOwner: role === 'admin', // can manage users
    isAdmin: role === 'admin' || role === 'editor' || role === 'entry', // can add / edit data (name kept for existing pages)
    canDelete: role === 'admin' || role === 'editor', // Data entry cannot delete
    canRead: role === 'admin' || role === 'editor' || role === 'viewer' || role === 'entry',
    isDataEntry: role === 'entry',
    isEntry: role === 'driver' // the Driver level: only the Driver trip form
  };
}

export default function AuthGate({ children, adminOnly = false, ownerOnly = false, entryPage = false, wide = false, theme = '' }) {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState(null);
  const [pageAi, setPageAi] = useState(null);
  const faisalValue = useMemo(() => ({ setPageAi }), []);
  const greet = useMemo(() => defaultGreeting(user?.name ? user.name.charAt(0).toUpperCase() + user.name.slice(1) : ''), [user?.name]);

  useEffect(() => {
    if (!theme) return undefined;
    document.body.classList.add(`theme-${theme}`);
    return () => document.body.classList.remove(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    const supabase = sb();
    supabase.auth.getSession().then(({ data }) => {
      const u = readUser(data.session);
      setAppRole(u?.role || '');
      if (!u) router.replace('/login');
      else if (u.isEntry && !entryPage) router.replace('/entry'); // data entry users only see the entry form
      else if (u.canRead) loadAddedCompanies(supabase).then(() => setUser(u)); // ＋ Add company: extra companies first
      else setUser(u);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setUser(null); router.replace('/login'); }
    });
    // phone Back button can bring back an old copy of the page: check the login again
    const onShow = (e) => { if (e.persisted) supabase.auth.getSession().then(({ data }) => { if (!data.session) window.location.replace('/login'); }); };
    window.addEventListener('pageshow', onShow);
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('pageshow', onShow); };
  }, [router, entryPage]);

  // Activity log for the Administrator (/activity)
  useEffect(() => {
    if (user) startActivity(user);
  }, [user]);

  useEffect(() => {
    if (user && path) logPage(path);
  }, [user, path]);

  // Edit password: opening another page locks editing again
  useEffect(() => { lockEdit(); }, [path]);

  // Admin password (5 Nov 2026, Owner): Admin opens only after the password; stays open while moving inside Admin
  // (Settings, Users, Activity, Power Editor). 11 Nov 2026 (Owner): asked ONCE per browser tab, not on every Admin
  // page / button (kept in sessionStorage, lib/editLock.js; cleared on Logout)
  const [adminOk, setAdminOkState] = useState(false);
  useEffect(() => { if (isAdminOpen()) setAdminOkState(true); }, []);
  const setAdminOk = (v) => { if (v) openAdmin(); setAdminOkState(!!v); };
  const [drvPw, setDrvPw] = useState(false); // driver: 🔑 change own password
  // 💬 Chat unread count (Owner 11 Nov 2026, app/chat): on the Chat button and the driver bar
  const [chatN, setChatN] = useState(0);
  useEffect(() => {
    if (!user) return undefined;
    let stop = false;
    const load = () => sb().rpc('chat_unread').then(({ data }) => { if (!stop) setChatN((data || []).reduce((t, x) => t + Number(x.unread || 0), 0)); }, () => {});
    load();
    const t = setInterval(load, 30000);
    window.addEventListener('tudo-chat-read', load);
    return () => { stop = true; clearInterval(t); window.removeEventListener('tudo-chat-read', load); };
  }, [user]);
  // 🔑 access per company page (Owner 11 Nov 2026, lib/pageAccess.js): block a page or lower the level on it
  const [mine, setMine] = useState(null);
  useEffect(() => {
    if (!user) return;
    if (user.isOwner || user.isEntry) { setMine({}); return; }
    loadMyPages(user).then(setMine).catch(() => setMine({}));
  }, [user]);
  const gate = user && mine ? pageGate(user, mine, path || '', typeof window === 'undefined' ? '' : window.location.search) : null;
  const pageRole = gate?.role && gate.role !== user?.role ? gate.role : '';
  const shownUser = useMemo(() => (user && pageRole ? { ...user, ...roleFlags(pageRole), isOwner: user.isOwner, baseRole: user.role } : user), [user, pageRole]);

  // Every page opens at the top (no jumping to the middle)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    if (window.location.hash) return undefined;
    window.scrollTo(0, 0);
    const t = setTimeout(() => window.scrollTo(0, 0), 60);
    return () => clearTimeout(t);
  }, [path]);

  /* Logout (31 Oct 2026): hide every bit of data at once, sign out on this device, clear the saved login,
     then load the login page fresh (no Back to old data). Drivers go back to their own link with the
     username filled in. Each step has a time limit so a weak phone signal cannot leave the data on screen. */
  const [leaving, setLeaving] = useState(false);
  async function switchUser() {
    const dest = user?.isEntry && user.username ? `/d/${user.username}?out=1` : '/login?out=1';
    setLeaving(true);
    const limit = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
    closeAdmin(); clearMyPages();
    try { await limit(endActivity('logout'), 1500); } catch { /* ignore */ }
    try { await limit(sb().auth.signOut({ scope: 'local' }), 2000); } catch { /* ignore */ }
    try { Object.keys(localStorage).filter((k) => k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
    window.location.replace(dest);
  }

  if (leaving) return <div className="loading">Logging out...</div>;
  if (!user || mine === null) return <div className="loading">Loading...</div>;

  // Sitemap and Timeline moved to the right side, just before Day / Night (4 Nov 2026)
  const nav = user.isEntry ? [['/entry', 'Data entry', 'entry'], ['/chat', 'Chat', 'chat']] : [['/', 'Home', 'home']];
  const sideLinks = user.isEntry ? [] : [['/sitemap', 'Sitemap', 'map'], ['/timeline', 'Timeline', 'clock']];
  // Phone / tablet: quick buttons next to Home (on Home the alerts list pushes the tiles far down)
  // Transport lives inside Office Expense (4th tab), so it has no top bar button of its own
  const quick = user.canRead ? [['/inventory', 'Inventory', 'box'], ['/expenses', 'All Companies', 'receipt']] : [];
  // Buttons that used to sit at the bottom of Home (31 Oct 2026): now in the top bar
  // Settings, Users and Activity live inside Admin (/admin) since 31 Oct 2026
  // Full access (editor): everything except the Admin panel; only the Administrator gets the Admin button (31 Oct 2026)
  // Invoices moved into the All Companies tabs (before VAT return), 1 Nov 2026
  // 9 Nov 2026: Data entry button removed: Drivers data entry is in All Companies › Al Noor, Staff data entry and Create users in Admin
  // 👥 Personnel (1 Nov 2026): Employees (Office, Drivers, Site, Subcontractors, Attendance), just before Admin
  if (user.canRead) quick.push(['/personnel', 'Employees', 'users']);
  // 📊 Reports & Summary (was the Group Summary tab of All Companies), 1 Nov 2026
  // 9 Nov 2026: Reports & Summary is inside each company; the complete summary is with the Chairman (Khalid Nasser)
  // 🏦 Accounts (4 Nov 2026): Bank & Cash ledger, Balance sheet, Money to receive / pay, Assets & loans, just before Admin
  if (user.canRead) quick.push(['/accounts', 'Accounts', 'bank']);
  // 👑 Chairman (6 Nov 2026): just before Admin; Administrator and the chairmen (lib/chairmen.js)
  // ⭐ Lead Staff (11 Nov 2026): the Chairman button renamed; inside 👑 Chairman (Khalid, Salim) and 🛡 Admins (Faisal, Hamad).
  // The Faisal button moved inside Lead Staff › Admins; it lights up on /chairman and /faisal pages too
  if (canSeeLeadStaff(user)) quick.push(['/lead-staff', 'Lead Staff', 'crown']);
  if (user.canRead) quick.push(['/chat', 'Chat', 'chat']); // 💬 Chat (11 Nov 2026)
  if (user.isOwner) quick.push(['/admin', 'Admin', 'shield']); // company buttons moved to All Companies (9 Nov 2026)

  let blocked = '';
  if (ownerOnly && !user.isOwner) blocked = 'Only Administrator can open this page.';
  else if (adminOnly && !user.isAdmin) blocked = 'You need Full access to open this page.';
  if (!blocked && gate?.block) blocked = gate.block;
  const adminLocked = !blocked && user.isOwner && isAdminArea(path) && !adminOk && !isAdminOpen();

  return (
    <UserCtx.Provider value={shownUser}>
      <FaisalCtx.Provider value={faisalValue}>
      <header className="topbar tbx">
        <div className="tbx-inner">
          <div className="tbx-row">
            <Link href={user.isEntry ? '/entry' : '/'} className="tbx-brand" aria-label="Daftar Office System, home">
              <span className="tbx-logo"><img src="/daftar-logo.png" alt="" /></span>
              <span className="tbx-name">
                <b>Daftar</b>
                <small>Office Systems</small>
              </span>
            </Link>
            <div className="tbx-tools">
              {user.canRead && !user.isEntry && <span className="tbx-view"><ViewSwitch /></span>}
              {sideLinks.map(([href, label, ico]) => (
                <Link key={href} href={href === '/sitemap' && path !== '/sitemap' ? `/sitemap?from=${encodeURIComponent(path)}` : href} className={`tbx-tlink${path.startsWith(href) ? ' active' : ''}`} title={label} aria-label={label}>
                  <Ico name={ico} /><span>{label}</span>
                </Link>
              ))}
              <ThemeMenu />
              <AccountMenu user={user} onLogout={switchUser} showView={user.canRead && !user.isEntry} />
            </div>
          </div>
          <nav className={`tbx-nav n${nav.length + quick.length}`} aria-label="Main">
            {nav.map(([href, label, ico]) => (
              <Link key={href} href={href} className={(href === '/' ? path === '/' : path.startsWith(href)) ? 'active' : ''}>
                <Ico name={ico} /><span>{label}</span>{href === '/chat' && chatN > 0 && <em className="tbx-badge">{chatN}</em>}
              </Link>
            ))}
            {quick.length > 0 && <i className="tbx-sep" aria-hidden="true" />}
            {quick.map(([href, label, ico]) => (
              <Link key={href} href={href} className={path === href || (href === '/admin' && ['/settings', '/users', '/activity'].some((x) => path.startsWith(x))) || (path.startsWith(`${href}/`) && !(href === '/expenses' && path.startsWith('/expenses/summary'))) || (href === '/expenses' && (path.startsWith('/transport') || path === '/docs')) || (href === '/lead-staff' && (path.startsWith('/chairman') || path.startsWith('/faisal'))) ? 'active' : ''}>
                <Ico name={ico} /><span>{label}</span>{href === '/chat' && chatN > 0 && <em className="tbx-badge">{chatN}</em>}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {/* 9 Nov 2026 (Owner): every login sees who is logged in, on phone and computer */}
      {!user.isEntry && (
        <div className="who-bar no-print" role="status">
          <span className="who-av" aria-hidden="true">{(user.name || '?').charAt(0).toUpperCase()}</span>
          <span>Logged in as <b>{user.name ? user.name.charAt(0).toUpperCase() + user.name.slice(1) : user.username}</b> · {ROLES[user.role]?.label || user.role}</span>
        </div>
      )}
      {/* Driver login: who is logged in + Logout, always visible (so the office can leave a driver login while testing) */}
      {user.isEntry && (
        <div className="drv-who no-print">
          <span>👤 Logged in as <b>{user.name}</b> (Driver)</span>
          <Link href="/chat" className="drv-chat">💬 Chat{chatN > 0 ? ` (${chatN})` : ''}</Link>
          <button type="button" onClick={() => setDrvPw(true)}>🔑 Password</button>
          <button type="button" onClick={switchUser}>Logout</button>
          {drvPw && <ChangePassword username={user.username} onClose={() => setDrvPw(false)} />}
        </div>
      )}
      {!blocked && !user.isEntry && (showTransportSide(path) || showExpenseSide(path) || showPersonnelSide(path)) ? (
        <main className="page wide has-side">
          <SideHover />
          {showTransportSide(path) ? <TransportSideNav isAdmin={user.isAdmin} /> : showPersonnelSide(path) ? <PersonnelSideNav /> : <ExpenseSideNav isAdmin={user.isAdmin} user={user} />}
          <div className="side-main"><Breadcrumbs /><div className="pc-home no-print" />{showTransportSide(path) && <OfficeTabs user={user} />}{path.startsWith('/transport') ? <TransportGate>{children}</TransportGate> : children}</div>
        </main>
      ) : (
        <main className={`page${wide ? ' wide' : ''}`}>
          {blocked ? <div className="error">{blocked}</div> : adminLocked ? <AdminLock onOpen={() => setAdminOk(true)} /> : <><Breadcrumbs /><div className="pc-home no-print" />{(path.startsWith('/transport') || path === '/entry') && !user.isEntry ? <TransportGate>{children}</TransportGate> : children}</>}
        </main>
      )}
      {/* 🖨 Print with column choice (1 Nov 2026): in each page's toolbar, not in the top bar */}
      {user.canRead && !blocked && !user.isEntry && <PrintColumns auto />}
      <BackToTop />
      <EditPasswordHost />
      <LookApplier />
      {user.isOwner && <PowerMode />}
      {user.canRead && !blocked && <TableCards />}
      {user.canRead && !blocked && <ColumnResize />}
      {user.canRead && !blocked && <TableFilter />}
      {user.canRead && (
        <FaisalAssistant
          context={pageAi?.context || ''}
          greeting={pageAi?.greeting || greet}
          alertCount={pageAi?.alertCount || 0}
          page={path}
          canChangePic={user.isOwner}
        />
      )}
      </FaisalCtx.Provider>
    </UserCtx.Provider>
  );
}

/* Line icons for the top bar (follow the text colour) */
const ICONS = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" /></>,
  map: <><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  truck: <><path d="M2 6h11v10H2z" /><path d="M13 9h4.5L21 12.5V16h-8z" /><circle cx="6" cy="17.5" r="2" /><circle cx="17" cy="17.5" r="2" /></>,
  box: <><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></>,
  receipt: <><path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  entry: <><path d="M8 4h8v3H8z" /><path d="M16 5.5h2.5V21h-13V5.5H8" /><path d="M9 12h6M9 16h4" /></>,
  invoice: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v3h3" /><path d="M9 11h6M9 15h6M9 7h3" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  bank: <><path d="M3 9.5 12 4l9 5.5" /><path d="M4 9.5h16" /><path d="M6 10v8M10 10v8M14 10v8M18 10v8" /><path d="M3 20.5h18" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4.2 3.9-6.5 8-6.5s7.2 2.3 8 6.5" /></>,
  crown: <><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /><path d="M5 19h14" /></>,
  shield: <><path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  chat: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.5c2.4 0 4 1.5 4.5 4.5" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  swap: <><path d="M7 4 3 8l4 4" /><path d="M3 8h13" /><path d="m17 12 4 4-4 4" /><path d="M21 16H8" /></>,
  logout: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></>
};

function Ico({ name }) {
  return (
    <svg className="tbx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/* Round button with the user's first letter; opens name, role, Logout (Switch user removed 31 Oct 2026: it did the same as Logout) */
function AccountMenu({ user, onLogout, showView }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false); // 🔑 Change my password (9 Nov 2026)
  const boxRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const role = ROLES[user.role]?.label || user.role;
  const display = user.name ? user.name.charAt(0).toUpperCase() + user.name.slice(1) : '';
  return (
    <div className="tbx-acct" ref={boxRef}>
      <button type="button" className={`tbx-me${open ? ' on' : ''}`} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} title={`${display} · ${role}`}>
        <span className="tbx-av">{display.charAt(0) || '?'}</span>
        <span className="tbx-me-text"><b>{display}</b><small>{ROLES[user.role]?.short || user.role}</small></span>
        <svg className="tbx-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="tbx-pop" role="menu">
          <div className="tbx-pop-who">
            <span className="tbx-av big">{display.charAt(0) || '?'}</span>
            <span><b>{display}</b><small>{role}</small></span>
          </div>
          {showView && <div className="tbx-pop-view"><small>View</small><ViewSwitch /></div>}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setPw(true); }}>🔑 Change my password</button>
          <button type="button" role="menuitem" className="out" onClick={onLogout}><Ico name="logout" /> Logout</button>
        </div>
      )}
      {pw && <ChangePassword username={user.username} onClose={() => setPw(false)} />}
    </div>
  );
}
