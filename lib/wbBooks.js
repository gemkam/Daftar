/*
  🦁 ALI PACK workbooks (Owner 11 Nov 2026): the two Excel files kept in the app, every tab a button.
  Nothing is added or changed: values, formulas, formats and layout are the Excel's own (lib/wbImport.js reads them,
  lib/wbEngine.js works the formulas out the same way as Excel). Saved in table company_books (supabase/ali-pack.sql).
*/
import SSF from 'ssf';
import { colNum, colStr } from '@/lib/wbEngine';

export { BOOKS, TAB_ICON, bookOfTab, tabHref, bookHref, LAYOUT, layoutOf, CARDS, TAB_PARENT, rootTabs, childTabs, tabPath } from '@/lib/wbTabs';

export { colNum, colStr };
export const parseAddr = (a) => { const m = /^([A-Z]+)(\d+)$/.exec(a || ''); return m ? { c: colNum(m[1]), r: Number(m[2]) } : null; };
export const rangeOf = (ref) => {
  const [a, b] = String(ref || '').split(':');
  const p = parseAddr(a); const q = parseAddr(b || a);
  return p && q ? { r1: Math.min(p.r, q.r), c1: Math.min(p.c, q.c), r2: Math.max(p.r, q.r), c2: Math.max(p.c, q.c) } : null;
};

/* Excel width (characters) -> pixels, Excel row height (points) -> pixels */
export const colPx = (w) => Math.round((w === undefined || w === null ? 8.43 : w) * 7 + 5);
export const rowPx = (h) => Math.round(((h === undefined || h === null ? 15 : h) * 96) / 72);

/* what Excel shows in the cell */
/* 13 Nov 2026 (Owner): no Excel error codes on screen. Divide by zero (#DIV/0!: nothing typed yet) and
   not found (#N/A) show as "–"; other errors still show so a broken formula can be seen. */
export const QUIET = '–';
export function showValue(v, fmt, eng) {
  if (eng && eng.isError(v)) { const t = eng.errText(v); return t === '#DIV/0!' || t === '#N/A' ? QUIET : t; }
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v && typeof v === 'object' && 'd' in v) v = v.d;
  if (typeof v === 'number') {
    if (fmt) {
      try { return String(SSF.format(fmt, v)).replace(/\s+$/, '').replace(/^\s+/, ''); } catch { /* fall back */ }
    }
    if (!Number.isFinite(v)) return '#NUM!';
    return String(Number(v.toPrecision(11)));
  }
  return String(v);
}
export const isDateFmt = (fmt) => !!fmt && /[dmy]/i.test(String(fmt).replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')) && !/0/.test(String(fmt).replace(/"[^"]*"/g, ''));

/* the text in the formula bar */
export function editText(cell) {
  if (!cell) return '';
  if (cell.f !== undefined) return `=${cell.f}`;
  const v = cell.v;
  if (v && typeof v === 'object' && 'd' in v) {
    const ms = Math.round((v.d - 25569) * 86400000);
    const d = new Date(ms);
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return v === null || v === undefined ? '' : String(v);
}

/* typed text -> cell content (like typing into Excel): =formula, number, date (dd/mm/yyyy or yyyy-mm-dd), TRUE / FALSE, text */
export function parseInput(text, old = {}) {
  const keep = { ...old };
  delete keep.v; delete keep.f; delete keep.c;
  const t = String(text ?? '');
  if (t === '') return Object.keys(keep).length ? keep : null;
  if (t.startsWith('=') && t.length > 1) return { ...keep, f: t.slice(1) };
  const num = t.replace(/,/g, '').trim();
  if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?%?$/i.test(num)) {
    const pct = num.endsWith('%');
    const x = Number(pct ? num.slice(0, -1) : num);
    return { ...keep, v: pct ? x / 100 : x };
  }
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t.trim());
  let d = null;
  if (m) d = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t.trim());
  if (m) d = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d !== null && !Number.isNaN(d)) return { ...keep, v: { d: d / 86400000 + 25569 }, ...(keep.n ? {} : { n: 'dd/mm/yyyy' }) };
  if (/^(true|false)$/i.test(t.trim())) return { ...keep, v: /^true$/i.test(t.trim()) };
  return { ...keep, v: t };
}

/* last row / column that has anything (for the sheet view) */
export function usedSize(sheet) {
  let r = 1; let c = 1;
  Object.keys(sheet.cells || {}).forEach((a) => { const p = parseAddr(a); if (p) { if (p.r > r) r = p.r; if (p.c > c) c = p.c; } });
  return { rows: Math.max(r, sheet.maxRow || 0), cols: Math.max(c, sheet.maxCol || 0) };
}

/* ---------- 📗 Excel: the workbook back as an .xlsx file, formulas kept, results filled in ---------- */
const argb = (h) => `FF${String(h).toUpperCase()}`;
export async function exportXlsx(book, eng, ExcelJS) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Daftar Office System';
  const mediaIds = {};
  Object.entries(book.media || {}).forEach(([id, src]) => {
    const m = /^data:image\/(\w+);base64,(.*)$/.exec(src || '');
    if (m) mediaIds[id] = wb.addImage({ base64: m[2], extension: m[1] === 'jpeg' ? 'jpeg' : m[1] });
  });
  for (const s of book.sheets || []) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    const { cols } = usedSize(s);
    for (let c = 1; c <= cols; c++) {
      const L = colStr(c);
      const col = ws.getColumn(c);
      if (s.cols?.[L]) col.width = s.cols[L];
      if ((s.hiddenCols || []).includes(L)) col.hidden = true;
    }
    Object.entries(s.rowH || {}).forEach(([r, h]) => { ws.getRow(Number(r)).height = h; });
    (s.hiddenRows || []).forEach((r) => { ws.getRow(r).hidden = true; });
    Object.entries(s.cells || {}).forEach(([a, e]) => {
      const cell = ws.getCell(a);
      const toVal = (v) => (v && typeof v === 'object' && 'd' in v ? new Date(Math.round((v.d - 25569) * 86400000)) : v);
      if (e.f !== undefined) {
        let res = eng.value(s.name, a);
        if (eng.isError(res)) res = { error: eng.errText(res) };
        cell.value = { formula: e.f, result: res === null ? undefined : res };
      } else cell.value = toVal(e.v);
      if (e.n) cell.numFmt = e.n;
      const font = {};
      if (e.b) font.bold = true; if (e.i) font.italic = true; if (e.u) font.underline = true;
      if (e.fs) font.size = e.fs; if (e.fc) font.color = { argb: argb(e.fc) }; if (e.fn) font.name = e.fn;
      if (Object.keys(font).length) cell.font = font;
      if (e.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(e.bg) } };
      const al = {};
      if (e.al) al.horizontal = { c: 'center', r: 'right' }[e.al] || undefined;
      if (e.va) al.vertical = 'middle';
      if (e.w) al.wrapText = true;
      if (Object.keys(al).length) cell.alignment = al;
      if (e.bd) {
        const k = ['top', 'right', 'bottom', 'left']; const b = {};
        e.bd.split('').forEach((x, i) => { if (x !== '0') b[k[i]] = { style: x === '2' ? 'medium' : 'thin' }; });
        cell.border = b;
      }
    });
    (s.merges || []).forEach((m) => { try { ws.mergeCells(m); } catch { /* ignore */ } });
    (s.images || []).forEach((im) => {
      if (mediaIds[im.m] === undefined) return;
      ws.addImage(mediaIds[im.m], { tl: { col: im.col - 1, row: im.row - 1 }, ext: { width: im.w || 160, height: im.h || 150 } });
    });
    if (s.printArea) ws.pageSetup.printArea = s.printArea;
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* Move a formula down or up by n rows, the way Excel does when a formula is filled down:
   A5 -> A6, $A$5 stays, A$5 stays, sheet names and text in quotes are not touched, function names (LOG10( ) are not refs. */
export function shiftFormula(f, n) {
  return String(f).split('"').map((part, i) => {
    if (i % 2) return part;
    return part.replace(/('(?:[^']|'')+'!|[A-Za-z_][\w.]*!)?(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\w(])/g, (m, sh, dc, col, dr, row, off, str) => {
      const prev = str[off - 1];
      if (prev && /[A-Za-z0-9_.]/.test(prev) && !sh) return m;
      return `${sh || ''}${dc}${col}${dr}${dr ? row : Number(row) + n}`;
    });
  }).join('"');
}
