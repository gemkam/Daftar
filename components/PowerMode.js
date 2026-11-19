'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { sb } from '@/lib/supabase';
import { LOOK_KEY, LOOK_CACHE, FONTS, parseLook, origOf, textNodes, elText, srcKey } from '@/lib/look';
import { isPowerOn, setPower, powerUndo, isBrowse, setBrowse } from '@/lib/power';

/*
  ⚡ Power switch layer (Owner 11 Nov 2026), rendered by AuthGate for the Administrator only.
  While the switch is ON (Admin › Power Editor, lib/power.js) a tap on any word, label or photo does NOT open it: a small
  box opens to rename the words, change the font / size / colour / bold / italic of that one item, or choose a new photo
  (logo). 💾 Save writes app_settings "look" (texts, marks, imgs in lib/look.js) for every user at once.
  Data is not changed here: table rows, input boxes, drop-downs and forms are skipped (they have their own ✏️ Edit).
  ▶ Open it does the normal tap (follow a link / press a button). OFF = nothing can be changed.
*/

const DATA = 'tbody, input, textarea, select, option, [contenteditable="true"]';
const newId = () => Math.random().toString(36).slice(2, 10);
const copy = (x) => JSON.parse(JSON.stringify(x));
const preview = (L) => window.dispatchEvent(new CustomEvent('tudo-look-preview', { detail: L }));

async function loadLook() {
  const { data, error } = await sb().from('app_settings').select('value').eq('key', LOOK_KEY).maybeSingle();
  if (error) throw error;
  return parseLook(data?.value || '{}');
}

async function saveLook(L) {
  const value = JSON.stringify(L);
  const { error } = await sb().from('app_settings').upsert({ key: LOOK_KEY, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  try { localStorage.setItem(LOOK_CACHE, value); } catch { /* ignore */ }
  preview(L);
}

/* what was tapped */
function pick(target) {
  let el = target instanceof Element ? target : target?.parentElement;
  if (el && el.closest('svg')) el = el.closest('svg').parentElement;
  if (!el) return null;
  if (el.closest(DATA)) return { data: true };
  if (el.tagName === 'IMG') return { kind: 'img', el, from: el.dataset.pwSrc || el.getAttribute('src') || '' };
  let k = 0;
  while (el && !elText(el) && k < 3) { el = el.parentElement; k += 1; }
  if (!el || el === document.body || el.tagName === 'MAIN' || el.tagName === 'HTML') return null;
  const nodes = textNodes(el).filter((n) => origOf(n).trim() !== '');
  if (!nodes.length) return null;
  if (nodes.length > 8) return { tooBig: true };
  return {
    kind: 'text', el, tag: el.tagName.toLowerCase(), text: elText(el),
    nodes: nodes.map((n) => ({ orig: origOf(n).trim(), cur: n.nodeValue.trim() }))
  };
}

/* the box values from what is saved now */
function formOf(L, sel, path) {
  const f = { scope: 'page', texts: [], font: '', size: '', color: '', weight: '', italic: false, img: '' };
  const here = (p) => p === path || p === '*';
  if (sel.kind === 'img') {
    const r = (L.imgs || []).filter((x) => srcKey(x.from) === srcKey(sel.from) && here(x.page)).pop();
    if (r) { f.img = r.to; f.scope = r.page === '*' ? 'all' : 'page'; }
    return f;
  }
  let star = false;
  f.texts = sel.nodes.map((n) => {
    const r = (L.texts || []).filter((t) => t.which === 'any' && String(t.from).trim() === n.orig && here(t.page || '*')).pop();
    if (r && (r.page || '*') === '*') star = true;
    return r ? r.to : n.orig;
  });
  const m = (L.marks || []).filter((x) => x.tag === sel.tag && x.text === sel.text && here(x.page)).pop();
  if (m) {
    const p = m.props || {};
    f.font = p['font-family'] || ''; f.size = p['font-size'] || ''; f.color = p.color || '';
    f.weight = p['font-weight'] || ''; f.italic = p['font-style'] === 'italic';
    if (m.page === '*') star = true;
  }
  if (star) f.scope = 'all';
  return f;
}

const starFirst = (list) => [...list.filter((x) => (x.page || '*') === '*'), ...list.filter((x) => (x.page || '*') !== '*')];

/* new look = saved look + this box */
function withForm(L0, sel, f, path) {
  const L = copy(L0);
  const page = f.scope === 'all' ? '*' : path;
  const same = (p) => (p || '*') === page || (f.scope === 'all' && p === path);
  if (sel.kind === 'img') {
    L.imgs = (L.imgs || []).filter((r) => !(srcKey(r.from) === srcKey(sel.from) && same(r.page)));
    if (f.img) L.imgs.push({ id: newId(), page, from: sel.from, to: f.img });
    L.imgs = starFirst(L.imgs);
    return L;
  }
  sel.nodes.forEach((n, i) => {
    const to = String(f.texts[i] ?? '').trim();
    L.texts = (L.texts || []).filter((t) => !(t.which === 'any' && String(t.from).trim() === n.orig && same(t.page)));
    if (to && to !== n.orig) L.texts.push({ id: newId(), page, which: 'any', from: n.orig, to });
    else if (page !== '*' && L.texts.some((t) => t.which === 'any' && String(t.from).trim() === n.orig && (t.page || '*') === '*')) {
      L.texts.push({ id: newId(), page, which: 'any', from: n.orig, to: n.orig }); // original words on this page only
    }
  });
  L.texts = starFirst(L.texts);
  L.marks = (L.marks || []).filter((m) => !(m.tag === sel.tag && m.text === sel.text && same(m.page)));
  const props = {};
  if (f.font) props['font-family'] = f.font;
  if (String(f.size).trim()) props['font-size'] = String(f.size).trim();
  if (f.color) props.color = f.color;
  if (f.weight) props['font-weight'] = f.weight;
  if (f.italic) props['font-style'] = 'italic';
  if (Object.keys(props).length) L.marks.push({ id: newId(), page, tag: sel.tag, text: sel.text, props });
  L.marks = starFirst(L.marks);
  return L;
}

/* every change of this item, on this page and everywhere, taken away */
function withoutItem(L0, sel, path) {
  const L = copy(L0);
  const here = (p) => (p || '*') === '*' || p === path;
  if (sel.kind === 'img') { L.imgs = (L.imgs || []).filter((r) => !(srcKey(r.from) === srcKey(sel.from) && here(r.page))); return L; }
  const words = new Set(sel.nodes.map((n) => n.orig));
  L.texts = (L.texts || []).filter((t) => !(t.which === 'any' && words.has(String(t.from).trim()) && here(t.page)));
  L.marks = (L.marks || []).filter((m) => !(m.tag === sel.tag && m.text === sel.text && here(m.page)));
  return L;
}

function shrink(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 600 / Math.max(im.width || 1, im.height || 1));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL(/png|gif|webp|svg/.test(file.type) ? 'image/png' : 'image/jpeg', 0.88));
      };
      im.onerror = () => reject(new Error('This photo could not be opened.'));
      im.src = r.result;
    };
    r.onerror = () => reject(new Error('This file could not be read.'));
    r.readAsDataURL(file);
  });
}

export default function PowerMode() {
  const path = usePathname() || '/';
  const [on, setOn] = useState(false);
  const [browse, setBr] = useState(false); // 👆 Open mode: taps work normally
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState(null);
  const [base, setBase] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [undoCount, setUndoCount] = useState(powerUndo.length);
  const bypass = useRef(false);
  const hover = useRef(null);
  const picked = useRef(null);
  const timer = useRef(null);
  const selRef = useRef(null);
  selRef.current = sel;

  const flash = useCallback((text, kind = 'ok') => {
    setToast({ text, kind }); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const mark = (el) => {
    if (picked.current) picked.current.classList.remove('pw-picked');
    picked.current = el || null;
    if (el) el.classList.add('pw-picked');
  };

  const close = useCallback((restore = true) => {
    if (restore && base) preview(base);
    setSel(null); setForm(null); setBase(null); mark(null);
  }, [base]);

  // switch state
  useEffect(() => {
    setOn(isPowerOn());
    setBr(isBrowse());
    const f = (e) => setOn(!!e.detail);
    const g = (e) => setBr(!!e.detail);
    window.addEventListener('tudo-power', f);
    window.addEventListener('tudo-power-browse', g);
    return () => { window.removeEventListener('tudo-power', f); window.removeEventListener('tudo-power-browse', g); };
  }, []);

  // another page: close the box
  useEffect(() => { setSel(null); setForm(null); setBase(null); mark(null); }, [path]);

  const choose = useCallback(async (target) => {
    const s = pick(target);
    if (!s) return;
    if (s.data) { flash('This is data. Change it with the page\'s own ✏️ Edit.', 'err'); return; }
    if (s.tooBig) { flash('Tap closer on the words you want to change.', 'err'); return; }
    if (selRef.current && base) preview(base); // drop the unsaved preview of the last one
    try {
      const L = await loadLook();
      mark(s.el);
      setBase(L); setSel(s); setForm(formOf(L, s, window.location.pathname));
    } catch (e) { flash(e.message || 'Could not load', 'err'); }
  }, [base, flash]);

  // taps go to the box while ON
  useEffect(() => {
    const root = document.documentElement;
    if (!on || browse) { root.classList.remove('pw-on'); return undefined; }
    root.classList.add('pw-on');
    const mine = (t) => t instanceof Element && !!t.closest('.pw-ui, .modal-back, .modal');
    const stop = (e) => { if (bypass.current || mine(e.target)) return; e.preventDefault(); e.stopPropagation(); };
    const onClick = (e) => {
      if (bypass.current || mine(e.target)) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      choose(e.target);
    };
    const onOver = (e) => {
      if (mine(e.target)) return;
      const s = pick(e.target);
      const el = s && !s.data && !s.tooBig ? s.el : null;
      if (hover.current && hover.current !== el) hover.current.classList.remove('pw-hover');
      hover.current = el;
      if (el) el.classList.add('pw-hover');
    };
    const onKey = (e) => { if (e.key === 'Escape' && selRef.current) { e.preventDefault(); document.querySelector('.pw-panel [data-close]')?.click(); } };
    document.addEventListener('click', onClick, true);
    ['mousedown', 'pointerdown', 'dblclick', 'auxclick', 'submit'].forEach((t) => document.addEventListener(t, stop, true));
    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      root.classList.remove('pw-on');
      document.removeEventListener('click', onClick, true);
      ['mousedown', 'pointerdown', 'dblclick', 'auxclick', 'submit'].forEach((t) => document.removeEventListener(t, stop, true));
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('keydown', onKey, true);
      if (hover.current) hover.current.classList.remove('pw-hover');
      hover.current = null;
    };
  }, [on, browse, choose]);

  if (!on) return null;

  const set = (patch) => {
    const f = { ...form, ...patch };
    setForm(f);
    preview(withForm(base, sel, f, path)); // see it at once
  };

  async function save(next) {
    setBusy(true);
    try {
      const now = await loadLook(); // someone may have saved meanwhile
      powerUndo.push(JSON.stringify(now)); setUndoCount(powerUndo.length);
      await saveLook(next(now));
      flash('Saved. Everyone sees it now.');
      close(false);
    } catch (e) { flash(e.message || 'Could not save', 'err'); }
    setBusy(false);
  }

  async function undo() {
    if (!powerUndo.length) return;
    setBusy(true);
    try {
      await saveLook(parseLook(powerUndo.pop())); setUndoCount(powerUndo.length);
      close(false);
      flash('↶ Last change taken back.');
    } catch (e) { flash(e.message || 'Could not undo', 'err'); }
    setBusy(false);
  }

  function turnOff() {
    close(true);
    setPower(false);
  }

  function openIt() {
    const el = sel?.el;
    close(true);
    if (!el) return;
    bypass.current = true;
    try { el.click(); } finally { bypass.current = false; }
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { set({ img: await shrink(file) }); } catch (err) { flash(err.message, 'err'); }
  }

  const clickable = sel?.el && sel.el.closest('a, button, [role="button"], summary, label');

  return (
    <>
      <div className="pw-ui pw-onbar no-print" role="status">
        <span className="pw-dot" aria-hidden="true" />
        <b>⚡ Power ON</b>
        <span className="pw-onhint">{browse ? '👆 Open mode: tap to go inside pages' : '✏️ Change mode: tap a word, label or photo'}</span>
        {browse
          ? <button type="button" className="btn pw-modebtn" onClick={() => setBrowse(false)}>✏️ Change</button>
          : <button type="button" className="btn pw-modebtn" onClick={() => { close(true); setBrowse(true); }}>👆 Open pages</button>}
        <button type="button" className="btn ghost" disabled={!undoCount || busy} onClick={undo}>↶ Undo{undoCount ? ` (${undoCount})` : ''}</button>
        <button type="button" className="btn pw-offbtn" onClick={turnOff}>⏻ Turn off</button>
      </div>

      {sel && form && (
        <div className="pw-ui pw-panel no-print" role="dialog" aria-label="Change this">
          <div className="pw-ph">
            <b>{sel.kind === 'img' ? '🖼 Change photo' : '✏️ Change this'}</b>
            <button type="button" className="pw-x" data-close onClick={() => close(true)} aria-label="Close">✕</button>
          </div>

          {sel.kind === 'img' ? (
            <div className="pw-img">
              <img src={form.img || sel.from} alt="" />
              <label className="btn ghost">📷 Choose new photo<input type="file" accept="image/*" hidden onChange={onPhoto} /></label>
            </div>
          ) : (
            <>
              {sel.nodes.map((n, i) => (
                <label key={i} className="pw-f">
                  <span>Words{sel.nodes.length > 1 ? ` ${i + 1}` : ''}</span>
                  <input value={form.texts[i] ?? ''} onChange={(e) => { const t = [...form.texts]; t[i] = e.target.value; set({ texts: t }); }} />
                  {form.texts[i] !== n.orig && <small className="muted">Original: {n.orig}</small>}
                </label>
              ))}
              <div className="pw-row">
                <label className="pw-f"><span>Font</span>
                  <select value={form.font} onChange={(e) => set({ font: e.target.value })}>
                    <option value="">As it is</option>
                    {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                  </select>
                </label>
                <label className="pw-f pw-s"><span>Size (px)</span>
                  <input type="number" min="8" max="96" value={form.size} placeholder="As it is" onChange={(e) => set({ size: e.target.value })} />
                </label>
              </div>
              <div className="pw-row">
                <label className="pw-f"><span>Colour</span>
                  <span className="pw-col">
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(form.color) ? form.color : '#13836b'} onChange={(e) => set({ color: e.target.value })} />
                    {form.color ? <button type="button" className="pw-mini" onClick={() => set({ color: '' })}>As it is</button> : <small className="muted">As it is</small>}
                  </span>
                </label>
                <label className="pw-f"><span>Bold</span>
                  <select value={form.weight} onChange={(e) => set({ weight: e.target.value })}>
                    <option value="">As it is</option><option value="400">Normal</option><option value="600">Semi bold</option><option value="800">Bold</option>
                  </select>
                </label>
                <label className="pw-tick"><input type="checkbox" checked={form.italic} onChange={(e) => set({ italic: e.target.checked })} /> Italic</label>
              </div>
            </>
          )}

          <label className="pw-f"><span>Where</span>
            <select value={form.scope} onChange={(e) => set({ scope: e.target.value })}>
              <option value="page">Only on this page</option>
              <option value="all">Everywhere in the app</option>
            </select>
          </label>

          <div className="pw-pbtns">
            {clickable && <button type="button" className="btn pw-open" onClick={openIt}>▶ Open it</button>}
            <button type="button" className="btn" disabled={busy} onClick={() => save((now) => withForm(now, sel, form, path))}>{busy ? 'Saving...' : '💾 Save'}</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => save((now) => withoutItem(now, sel, path))}>↩ Back to original</button>
          </div>
        </div>
      )}

      {toast && <div className={`pw-ui toast ${toast.kind}`} role="status">{toast.text}</div>}
    </>
  );
}
