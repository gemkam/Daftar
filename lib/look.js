/*
  App look set by the Administrator in Admin > 🛠 Power Editor (tabs 🎨 Styles, 📐 Layout, ✏️ Texts). Same for every user.
  Saved in app_settings key "look" as JSON { styles: [rule], layout: [rule], texts: [text] }, cached per device in
  localStorage "tudo-look". Applied by components/LookApplier.js (inside AuthGate):
    - styles / layout -> one <style id="tudo-look"> with !important rules (wins over globals.css and the colour theme)
    - texts -> page heading, intro line or any exact text replaced in place (text nodes only, so React keeps working)
  rule = { id, target, custom (CSS selector when target = custom), prop, value }
  text = { id, page ('*' = every page, '/expenses' or '/transport*' = that page and below), which ('h1' | 'sub' | 'any'), from, to }
  ⚡ Power switch (11 Nov 2026, components/PowerMode.js): Administrator taps a word / photo in the app itself.
  mark = { id, page, tag, text, props: { font-family, font-size, color, font-weight, font-style } } -> font of that one item
         (elements with that tag whose own original words are `text`, on that page or '*'), via data-pw-s="id ..."
  img  = { id, page, from (original src), to (data: URL) } -> photo / logo replaced
*/

export const LOOK_KEY = 'look';
export const LOOK_CACHE = 'tudo-look';
export const EMPTY_LOOK = { styles: [], layout: [], texts: [], marks: [], imgs: [] };

export const TARGETS = [
  ['app', 'Whole app (all text)', 'body'],
  ['page', 'Page area', 'main.page'],
  ['h1', 'Page headings', 'main h1'],
  ['h2', 'Section titles', 'main h2'],
  ['sub', 'Intro lines (under the heading)', 'main .sub'],
  ['company-head', 'Heading card (All Companies pages)', '.company-head'],
  ['btn', 'Buttons', '.btn'],
  ['tabs', 'Company tabs', '.co-switch'],
  ['toolbar', 'Toolbars', '.page-tools .tools'],
  ['tiles', 'Number cards (Total amount, KPIs)', '.rp-tile, .kpi, .stat'],
  ['thead', 'Table headings', 'main table thead th'],
  ['td', 'Table cells', 'main table td'],
  ['topbar', 'Top bar', 'header.tbx'],
  ['brand', 'Top bar name and logo', '.tbx-brand'],
  ['crumbs', 'Breadcrumbs (Home › ...)', 'nav.bc'],
  ['home-hero', 'Home heading', '.home-hero'],
  ['home-grid', 'Home tiles area', '.home-grid'],
  ['home-tiles', 'Home tiles', '.hub-tile'],
  ['alerts', 'Home alerts box', '.alerts-col'],
  ['powered', 'Powered by KS TECH line', '.powered-by'],
  ['watermark', 'Watermark', '.watermark'],
  ['faisal', 'Faisal button', '.noor-orb'],
  ['custom', 'Other (type a CSS selector)', '']
];

export const FONTS = ['Work Sans', 'Fraunces', 'Georgia', 'Arial', 'Tahoma', 'Verdana', 'Trebuchet MS', 'Segoe UI', 'Times New Roman', 'Garamond', 'Courier New', 'Impact', 'Brush Script MT', 'system-ui'];

/* [key, label, kind, extra] kind: color | px | select | number | yes */
export const STYLE_PROPS = [
  ['color', 'Text colour', 'color'],
  ['background', 'Background colour', 'color'],
  ['font-family', 'Font', 'select', FONTS],
  ['font-size', 'Text size (px)', 'px'],
  ['font-weight', 'Bold', 'select', ['400 Normal', '500 Medium', '600 Semi bold', '700 Bold', '800 Extra bold']],
  ['font-style', 'Italic', 'select', ['normal', 'italic']],
  ['text-transform', 'Capital letters', 'select', ['none', 'uppercase', 'capitalize', 'lowercase']],
  ['letter-spacing', 'Letter spacing (px)', 'px'],
  ['border-radius', 'Corner roundness (px)', 'px'],
  ['border-color', 'Border colour', 'color'],
  ['box-shadow', 'Shadow', 'select', ['none', 'soft', 'strong']],
  ['opacity', 'See-through (0 to 1)', 'number']
];

export const LAYOUT_PROPS = [
  ['hide', 'Hide it', 'yes'],
  ['max-width', 'Width (px)', 'px'],
  ['min-height', 'Height at least (px)', 'px'],
  ['padding', 'Space inside (px)', 'px'],
  ['gap', 'Space between items (px)', 'px'],
  ['margin-top', 'Space above (px)', 'px'],
  ['margin-bottom', 'Space below (px)', 'px'],
  ['columns', 'Columns side by side', 'number'],
  ['text-align', 'Align text', 'select', ['left', 'center', 'right']],
  ['position', 'Stay on top while scrolling', 'select', ['sticky', 'static']]
];

export const TEXT_WHICH = [['h1', 'Page heading'], ['sub', 'Intro line'], ['any', 'Any text (exact words)']];

export const propList = (kind) => (kind === 'layout' ? LAYOUT_PROPS : STYLE_PROPS);
export const propOf = (kind, key) => propList(kind).find((p) => p[0] === key);
export const targetOf = (key) => TARGETS.find((t) => t[0] === key);

export function parseLook(raw) {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const arr = (x) => (Array.isArray(x) ? x : []);
    return { styles: arr(v?.styles), layout: arr(v?.layout), texts: arr(v?.texts), marks: arr(v?.marks), imgs: arr(v?.imgs) };
  } catch { return { ...EMPTY_LOOK }; }
}

const clean = (s) => String(s ?? '').replace(/[{}<>;]/g, '').trim();

function decl(prop, value) {
  const v = clean(value);
  if (prop === 'hide') return v && v !== 'no' ? 'display: none' : '';
  if (v === '') return '';
  const px = (x) => (/^-?\d+(\.\d+)?$/.test(x) ? `${x}px` : x);
  switch (prop) {
    case 'font-size': case 'letter-spacing': case 'border-radius': case 'max-width': case 'min-height':
    case 'padding': case 'gap': case 'margin-top': case 'margin-bottom':
      return `${prop}: ${px(v)}`;
    case 'font-family': return `font-family: "${v}", system-ui, sans-serif`;
    case 'font-weight': return `font-weight: ${v.split(' ')[0]}`;
    case 'box-shadow': return `box-shadow: ${v === 'soft' ? '0 4px 14px rgba(0,0,0,.08)' : v === 'strong' ? '0 10px 30px rgba(0,0,0,.18)' : 'none'}`;
    case 'columns': { const n = Math.max(1, Math.min(8, parseInt(v, 10) || 1)); return `display: grid; grid-template-columns: repeat(${n}, minmax(0, 1fr))`; }
    case 'position': return v === 'sticky' ? 'position: sticky; top: 0; z-index: 50' : 'position: static';
    case 'border-color': return `border-color: ${v}; border-style: solid`;
    default: return `${prop}: ${v}`;
  }
}

export function selectorOf(rule) {
  if (rule.target === 'custom') return clean(rule.custom);
  return targetOf(rule.target)?.[2] || '';
}

export function lookCss(look) {
  const out = [];
  for (const r of [...(look.styles || []), ...(look.layout || [])]) {
    if (r.off) continue;
    const sel = selectorOf(r);
    const d = decl(r.prop, r.value);
    if (!sel || !d) continue;
    out.push(`${sel} { ${d.split(';').map((x) => x.trim()).filter(Boolean).map((x) => `${x} !important`).join('; ')}; }`);
  }
  return out.join('\n');
}

const ORIG = typeof WeakMap !== 'undefined' ? new WeakMap() : null; // text node -> { orig, set }
// the page's own words; if React changed the node since we set it, its new words are the original
export const origOf = (n) => { const r = ORIG.get(n); return r && n.nodeValue === r.set ? r.orig : n.nodeValue; };

export const pageMatch = (rulePage, path) => {
  const p = String(rulePage || '*').trim();
  if (p === '*' || p === '') return true;
  if (p.endsWith('*')) return path.startsWith(p.slice(0, -1));
  return path === p;
};

export function textNodes(root) {
  const list = [];
  if (!root) return list;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && n.parentElement.closest('script,style,textarea,input,select,option,[contenteditable="true"],.pw-noreplace,.pw-ui') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) list.push(n);
  return list;
}

function setNode(n, value) {
  const orig = origOf(n);
  ORIG.set(n, { orig, set: value });
  if (n.nodeValue !== value) n.nodeValue = value;
}

/* replace texts on the current page; text nodes are only changed in place (never removed) so React is not upset */
export function applyTexts(texts, path) {
  if (typeof document === 'undefined' || !ORIG) return;
  const main = document.querySelector('main');
  const touched = new Set();
  for (const t of texts || []) {
    if (t.off || !pageMatch(t.page, path) || String(t.to ?? '') === '' && t.which !== 'any') continue;
    if (t.which === 'h1' || t.which === 'sub') {
      const el = main && main.querySelector(t.which === 'h1' ? 'h1' : '.sub');
      if (!el) continue;
      const nodes = textNodes(el).filter((n) => origOf(n).trim() !== '');
      if (!nodes.length) continue;
      nodes.forEach((n, i) => { setNode(n, i === 0 ? t.to : ''); touched.add(n); });
    } else if (t.which === 'any' && String(t.from || '').trim()) {
      const from = String(t.from).trim();
      for (const n of textNodes(document.body)) {
        const o = origOf(n);
        if (o.trim() === from) { const lead = o.match(/^\s*/)[0]; const tail = o.match(/\s*$/)[0]; setNode(n, `${lead}${t.to ?? ''}${tail}`); touched.add(n); }
      }
    }
  }
  // put back texts whose rule was removed
  for (const n of textNodes(document.body)) {
    if (touched.has(n) || !ORIG.has(n)) continue;
    const r = ORIG.get(n); ORIG.delete(n);
    if (n.nodeValue === r.set && r.set !== r.orig) n.nodeValue = r.orig;
  }
}

/* ---------- ⚡ Power switch: font of one item, photos ---------- */

const safeId = (x) => String(x || '').replace(/[^a-z0-9]/gi, '');

/* the item's own original words (renamed words count as their original, so a font stays after a rename) */
export function elText(el) {
  return textNodes(el).map((n) => origOf(n)).join(' ').replace(/\s+/g, ' ').trim();
}

export function marksCss(look) {
  const out = [];
  for (const m of look.marks || []) {
    const id = safeId(m.id); const p = m.props || {};
    if (!id) continue;
    const d = [];
    if (p['font-family']) d.push(`font-family: "${clean(p['font-family'])}", system-ui, sans-serif`);
    if (p['font-size']) d.push(`font-size: ${parseFloat(p['font-size']) || 14}px`);
    if (p.color) d.push(`color: ${clean(p.color)}`);
    if (p['font-weight']) d.push(`font-weight: ${clean(p['font-weight'])}`);
    if (p['font-style']) d.push(`font-style: ${clean(p['font-style'])}`);
    if (d.length) out.push(`[data-pw-s~="${id}"], [data-pw-s~="${id}"] * { ${d.map((x) => `${x} !important`).join('; ')}; }`);
  }
  return out.join('\n');
}

export function applyMarks(marks, path) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-pw-s]').forEach((el) => el.removeAttribute('data-pw-s'));
  const byTag = {};
  for (const m of marks || []) {
    if (!m.text || !m.tag || !pageMatch(m.page, path) || !/^[a-z0-9]+$/i.test(m.tag)) continue;
    (byTag[m.tag] = byTag[m.tag] || []).push(m);
  }
  for (const tag of Object.keys(byTag)) {
    document.querySelectorAll(tag).forEach((el) => {
      if (el.closest('.pw-ui')) return;
      const t = elText(el);
      if (!t) return;
      const ids = byTag[tag].filter((m) => m.text === t).map((m) => safeId(m.id));
      if (ids.length) el.setAttribute('data-pw-s', ids.join(' '));
    });
  }
}

/* path of an image src without the site part, so /logo.png and https://site/logo.png are the same */
export const srcKey = (s) => { try { return String(s || '').startsWith('data:') ? String(s) : new URL(s, 'http://x').pathname; } catch { return String(s || ''); } };

export function applyImgs(imgs, path) {
  if (typeof document === 'undefined') return;
  const list = (imgs || []).filter((r) => r.from && r.to && pageMatch(r.page, path));
  for (const img of Array.from(document.images)) {
    if (img.closest('.pw-ui')) continue;
    const orig = img.dataset.pwSrc || img.getAttribute('src') || '';
    const key = srcKey(orig);
    let rule = null;
    for (const r of list) if (srcKey(r.from) === key) rule = r; // last one wins (page rule after '*')
    if (rule) {
      if (!img.dataset.pwSrc) img.dataset.pwSrc = orig;
      if (img.getAttribute('src') !== rule.to) { img.removeAttribute('srcset'); img.setAttribute('src', rule.to); }
    } else if (img.dataset.pwSrc) {
      img.setAttribute('src', img.dataset.pwSrc); delete img.dataset.pwSrc;
    }
  }
}
