'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthGate, { useUser } from '@/components/AuthGate';
import CompanyLock from '@/components/CompanyLock';
import EditToggle from '@/components/EditToggle';
import WbTable from '@/components/WbTable';
import WbPaper from '@/components/WbPaper';
import { sb } from '@/lib/supabase';
import { COMPANIES } from '@/lib/expenses';
import { myCompanyKeys, isCompanyUnlocked, unlockCompany } from '@/lib/companyAccess';
import { makeEngine } from '@/lib/wbEngine';
import { BOOKS, TAB_ICON, CARDS, bookOfTab, layoutOf, parseInput, exportXlsx, rootTabs, childTabs, tabPath } from '@/lib/wbBooks';
import Omr, { fmt3 } from '@/components/Omr';

/*
  🦁 ALI PACK workbooks (Owner 11 Nov 2026):
  "Running Accounts is a button. Inside it, each tab is a button. Inside each tab there are tables with the same calculations."
  Level 1 = the Excel file (📑 Quotation Management, 📒 Running Accounts) · Level 2 = its tabs · Level 3 = the tab's table.
  Values and formulas are the Excel's own and are worked out the same way as Excel (lib/wbEngine.js, checked on all 5,471 formulas).
  Document tabs (Quotation, Invoice, Purchase Order (AED), Delivery Note) show as the printed paper.
  Saved in table company_books (only Administrators and users given Ali Pack). The Excel data was put in by Claude (no upload button, Owner 11 Nov 2026).
  Tabs are the app's normal pill buttons (no tab look anywhere in the app).
*/
const CO = 'ali-pack';

function AliPack() {
  const user = useUser();
  const router = useRouter();
  const C = COMPANIES.find((c) => c.key === CO);
  const [allowed, setAllowed] = useState(null);
  const [open, setOpen] = useState(false);
  const [books, setBooks] = useState({});
  const [loadErr, setLoadErr] = useState('');
  const [bookKey, setBookKey] = useState('');
  const [tab, setTab] = useState('');
  const [editing, setEditing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [viewIds, setViewIds] = useState(null); // Excel rows shown in the table now (after filters)
  const [extra, setExtra] = useState({}); // tab -> rows added this visit (shown before anything is typed in them)
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState(null);
  const [undo, setUndo] = useState([]);
  const timers = useRef({});
  const latest = useRef({});
  const canWrite = !!user?.canDelete; // Administrator / Full access (database also needs Ali Pack access)
  latest.current = books;

  const flash = useCallback((text, kind = 'ok') => {
    setToast({ text, kind });
    clearTimeout(timers.current.toast);
    timers.current.toast = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    myCompanyKeys(user).then((k) => setAllowed(k === 'all' || k.includes(CO))).catch(() => setAllowed(false));
    setOpen(isCompanyUnlocked(CO));
  }, [user]);

  const load = useCallback(async () => {
    const { data, error } = await sb().from('company_books').select('*').eq('company', CO);
    if (error) { setLoadErr(error.message); setBooks({ quotation: null, accounts: null }); return; }
    const m = { quotation: null, accounts: null };
    (data || []).forEach((r) => { m[r.book] = r; });
    setBooks(m);
  }, []);
  useEffect(() => { if (allowed && open) load(); }, [allowed, open, load]);

  useEffect(() => {
    let b = ''; let t = '';
    try { const p = new URLSearchParams(window.location.search); b = p.get('book') || ''; t = p.get('tab') || ''; } catch { /* ignore */ }
    const bt = bookOfTab(t);
    if (bt) { setBookKey(bt.key); setTab(t); } else if (BOOKS.some((x) => x.key === b)) setBookKey(b);
  }, []);

  function go(b, t = '') {
    setBookKey(b); setTab(t); setShowHidden(false); setViewIds(null);
    const q = t ? `?book=${b}&tab=${encodeURIComponent(t)}` : b ? `?book=${b}` : '';
    try { window.history.replaceState(null, '', `/alipack${q}`); } catch { /* ignore */ }
  }

  const B = BOOKS.find((b) => b.key === bookKey) || null;
  const row = B ? books[B.key] : undefined;
  const sheets = row?.sheets;
  const eng = useMemo(() => (sheets ? makeEngine(sheets) : null), [sheets]);
  const sheet = sheets && tab ? sheets.find((s) => s.name === tab) : null;
  const lay = layoutOf(tab);
  const canEdit = canWrite && editing;

  /* ---------- save by itself, one second after the last change ---------- */
  function scheduleSave(key, what = 'sheets') {
    setStatus('Saving...');
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      const r = latest.current[key];
      if (!r) return;
      const body = { updated_by: user?.name || null, updated_at: new Date().toISOString(), sheets: r.sheets };
      if (what === 'signs') body.signs = r.signs || null;
      const { error } = await sb().from('company_books').update(body).eq('id', r.id);
      if (error) { setStatus(''); flash(error.code === '42501' ? 'You need Full access and Ali Pack access to save.' : error.message, 'err'); return; }
      setStatus('✓ Saved');
    }, 900);
  }

  /* change cells of this tab. mode 'text' = typed like Excel, 'cell' = whole cell (fill down) */
  function setCells(map, mode = 'text') {
    const key = B.key;
    const before = {};
    const cur = sheet?.cells || {};
    Object.keys(map).forEach((a) => { before[a] = cur[a] || null; });
    setBooks((all) => {
      const r = all[key];
      const nextSheets = r.sheets.map((s) => {
        if (s.name !== tab) return s;
        const cells = { ...s.cells };
        Object.entries(map).forEach(([a, x]) => {
          const cell = mode === 'text' ? parseInput(x, cells[a] || {}) : x;
          if (cell) cells[a] = cell; else delete cells[a];
        });
        return { ...s, cells };
      });
      return { ...all, [key]: { ...r, sheets: nextSheets } };
    });
    setUndo((u) => [...u.slice(-49), { key, tab, before }]);
    scheduleSave(key);
  }

  function doUndo() {
    const u = undo[undo.length - 1];
    if (!u) return;
    setUndo(undo.slice(0, -1));
    setBooks((all) => {
      const r = all[u.key];
      const nextSheets = r.sheets.map((s) => {
        if (s.name !== u.tab) return s;
        const cells = { ...s.cells };
        Object.entries(u.before).forEach(([a, c]) => { if (c) cells[a] = c; else delete cells[a]; });
        return { ...s, cells };
      });
      return { ...all, [u.key]: { ...r, sheets: nextSheets } };
    });
    scheduleSave(u.key);
  }

  function setSigns(v) {
    const key = B.key;
    setBooks((all) => ({ ...all, [key]: { ...all[key], signs: { ...(all[key].signs || {}), [tab]: v } } }));
    scheduleSave(key, 'signs');
  }

  async function downloadXlsx() {
    if (!row || !eng) return;
    setBusy('Making the Excel file...');
    try {
      const ExcelJS = (await import('exceljs')).default;
      const blob = await exportXlsx(row, eng, ExcelJS);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${B.file.replace(/\.xlsx$/i, '')} (${new Date().toISOString().slice(0, 10)}).xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) { flash(`Could not make the Excel file: ${err?.message || err}`, 'err'); }
    setBusy('');
  }

  function printTab() {
    document.body.classList.add('wb-printing');
    const done = () => { document.body.classList.remove('wb-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  }

  /* ---------- gates ---------- */
  if (allowed === null) return <p className="muted">Loading...</p>;
  if (!allowed) return <p className="empty">You have no access to Ali Pack. Ask the Administrator. <Link href="/expenses">Back to All Companies</Link></p>;
  if (!open) {
    return (
      <div style={{ margin: '30px auto', maxWidth: 400 }}>
        <CompanyLock inline company={C} onOpen={() => { unlockCompany(CO); setOpen(true); }} onCancel={() => router.push('/expenses')} />
      </div>
    );
  }

  const hasHidden = sheet && lay.kind === 'table' && (sheet.hiddenCols || []).length > 0;
  const isTable = sheet && lay.kind === 'table';

  /* summary boxes (lib/wbTabs CARDS): plain totals of the table's own columns for the rows shown */
  const cardDefs = (isTable && CARDS[tab]) || [];
  const rowsShown = viewIds || [];
  const numAt = (L, r) => {
    const e = sheet.cells?.[`${L}${r}`];
    if (!e) return 0;
    let v = e.f !== undefined ? eng.value(tab, `${L}${r}`) : e.v;
    if (v && typeof v === 'object' && 'd' in v) v = v.d;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  };
  const cardVal = (d) => {
    if (d.how === 'count') return rowsShown.length;
    if (d.how === 'last') { const r = rowsShown[rowsShown.length - 1]; return r ? numAt(d.cols[0], r) : 0; }
    return Math.round(rowsShown.reduce((t, r) => t + d.cols.reduce((x, L) => x + numAt(L, r), 0), 0) * 1000) / 1000;
  };

  const tools = (
    <>
      {hasHidden && <button type="button" className="btn small" aria-pressed={showHidden} onClick={() => setShowHidden(!showHidden)}>{showHidden ? '🙈 Hide hidden columns' : '👁 Show hidden columns'}</button>}
      {row && sheet && <button type="button" className="btn small" onClick={printTab}>🖨 Print</button>}
      {row && <button type="button" className="btn small" onClick={downloadXlsx} disabled={!!busy}>📗 Excel</button>}
      {(busy || status) && <span className="muted wb-status">{busy || status}</span>}
    </>
  );

  return (
    <>
      <div className="company-head ch-top wb-noprint">
        {C?.logo && <span className="wb-logo"><img src={C.logo} alt="" /></span>}
        <div>
          <h1 style={{ margin: 0 }}>{C?.short}{B ? ` · ${B.title}` : ''}{tab ? ` · ${tab}` : ''}</h1>
          <div className="muted">{C?.name} · {C?.cr}</div>
        </div>
        <Link className="btn ghost small" href={`/company/${CO}`} style={{ marginLeft: 'auto' }}>↗ Open company</Link>
      </div>

      {/* Level 1: the Excel files, pill buttons like Bills / Invoices */}
      <div className="head-chips wb-noprint">
        {BOOKS.map((b) => (
          <button key={b.key} type="button" className={`rp-chip ${b.key === bookKey ? 'active' : ''}`} aria-pressed={b.key === bookKey} onClick={() => go(b.key)}>
            {b.ico} {b.title}
          </button>
        ))}
      </div>

      {/* Level 2: the buttons inside the chosen file. A tab that fills itself from another tab is a button
          inside that tab (lib/wbTabs.js TAB_PARENT): Costing › Quotation, Purchase Order, Invoice; Quotation › Delivery Note */}
      {B && (() => {
        const path = tab ? tabPath(tab) : [];
        const chip = (t) => (
          <button key={t} type="button" className={`rp-chip ${t === tab ? 'active' : path.includes(t) ? 'active wb-up' : ''}`} aria-pressed={t === tab} onClick={() => go(B.key, t)}>
            {TAB_ICON[t] || '📄'} {t}{childTabs(B, t).length ? ' ▾' : ''}
          </button>
        );
        return (
          <>
            <div className="head-chips wb-noprint">{rootTabs(B).map(chip)}</div>
            {path.filter((p) => childTabs(B, p).length).map((p) => (
              <div key={p} className="head-chips wb-noprint wb-sub">
                <span className="wb-sub-l">↳ Inside {TAB_ICON[p] || '📄'} {p}:</span>
                {childTabs(B, p).map(chip)}
              </div>
            ))}
          </>
        );
      })()}

      {loadErr && <p className="error wb-noprint">{loadErr}</p>}
      {!B && <p className="muted wb-noprint">Choose a button above.</p>}
      {B && row === undefined && <p className="muted">Loading...</p>}
      {B && row === null && <p className="empty wb-noprint">{B.title} has no data yet.</p>}
      {B && row && !tab && <p className="muted wb-noprint">Choose a button of {B.title}.</p>}
      {row && tab && !sheet && <p className="empty">This file has no part named “{tab}”.</p>}

      {/* summary boxes, like the Bills page */}
      {cardDefs.length > 0 && viewIds && (
        <div className="rp-tiles dx-tiles wb-noprint">
          {cardDefs.map((d) => (
            <div key={d.label} className="rp-tile">
              <div className="rp-tile-label">{d.label}</div>
              <div className="rp-tile-num">{d.how === 'count' ? cardVal(d) : d.omr ? <Omr v={cardVal(d)} /> : fmt3(cardVal(d))}</div>
              <div className="rp-tile-sub">{d.sub || `${rowsShown.length} ${rowsShown.length === 1 ? 'row' : 'rows'} · ${C?.short}`}</div>
            </div>
          ))}
        </div>
      )}

      {/* toolbar panel, like the Bills page */}
      {row && sheet && (!canEdit ? (
        <div className="dx-bar dx-bar-off wb-noprint">
          <EditToggle show={canWrite} on={editing} onClick={() => setEditing(!editing)} close={false} />
          {tools}
          {canWrite && <span className="muted dx-hint">Press Edit to type in {lay.kind === 'paper' ? 'the paper' : 'the table'}{lay.add ? ' or add rows' : ''}</span>}
          {canWrite && <span className="dx-right"><EditToggle show on={editing} onClick={() => setEditing(!editing)} close={false} /></span>}
        </div>
      ) : (
        <div className="dx-bar wb-noprint">
          <b>✏️ Edit</b>
          {tools}
          {undo.length > 0 && <button type="button" className="btn small" onClick={doUndo}>↶ Undo</button>}
          <span className="muted dx-hint">{lay.kind === 'paper' ? 'Click a box on the paper and type.' : 'Click a cell and type. Calculated cells fill by themselves.'}</span>
          <span className="dx-right"><EditToggle show on={editing} onClick={() => setEditing(!editing)} close={false} /></span>
        </div>
      ))}

      {row && sheet && eng && (lay.kind === 'paper' ? (
        <div style={{ marginTop: 12 }}>
          <WbPaper sheet={sheet} tab={tab} eng={eng} media={row.media} canEdit={canEdit} setCells={setCells} signs={row.signs?.[tab]} setSigns={setSigns} flash={flash} />
        </div>
      ) : (
        <div className="wb-tablebox">
          <WbTable key={tab} sheet={sheet} tab={tab} eng={eng} layout={lay} canEdit={canEdit} setCells={setCells} showHidden={showHidden} flash={flash}
            onView={setViewIds}
            extraRows={extra[tab] || []} onAddRow={(r) => setExtra((x) => ({ ...x, [tab]: [...(x[tab] || []), r] }))} />
        </div>
      ))}
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
    </>
  );
}

export default function Page() {
  return <AuthGate wide><AliPack /></AuthGate>;
}
