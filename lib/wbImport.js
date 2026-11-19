/*
  Read an Excel file (.xlsx) into the app's workbook form, exactly as Excel keeps it:
  every typed value, every formula (same text), number formats, fonts, fill colours, borders, alignment,
  column widths, row heights, merged cells, hidden rows / columns, print area and the logo picture at the top.
  Returns { sheets, media } (media = pictures by id, kept once).
*/
const DAY = 86400000;
const EPOCH = Date.UTC(1899, 11, 30);
const serial = (d) => (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()) - EPOCH) / DAY;

function plain(v) {
  if (v instanceof Date) return { d: serial(v) };
  if (v && typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.error) return v.error;
    if (v.text !== undefined && v.hyperlink !== undefined) return v.text;
  }
  return v;
}

function toB64(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (typeof Buffer !== 'undefined' && typeof window === 'undefined') return Buffer.from(u8).toString('base64');
  let bin = '';
  for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return btoa(bin);
}

/* theme colours (Excel stores many fills / font colours as "theme colour + tint") */
function themeList(xml) {
  const pick = (tag) => {
    const m = new RegExp(`<a:${tag}>([\\s\\S]*?)</a:${tag}>`).exec(xml || '');
    if (!m) return null;
    const c = /srgbClr val="([0-9A-Fa-f]{6})"/.exec(m[1]) || /lastClr="([0-9A-Fa-f]{6})"/.exec(m[1]);
    return c ? c[1].toUpperCase() : null;
  };
  return ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map(pick);
}
function tintHex(hex, tint) {
  if (!tint) return hex;
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
  let h = 0; let sat = 0; let l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  if (sat === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat; const p = 2 * l - q;
    r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3);
  }
  return [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function readXlsx(buffer, ExcelJS) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const theme = themeList((wb._themes && wb._themes.theme1) || '');
  const colorOf = (c) => {
    if (!c) return null;
    if (c.argb) return String(c.argb).slice(-6).toUpperCase();
    if (c.theme !== undefined && theme[c.theme]) return tintHex(theme[c.theme], c.tint || 0);
    return null;
  };
  const sheets = [];
  const media_ = {};
  wb.eachSheet((ws) => {
    const cells = {};
    const hiddenRows = [];
    ws.eachRow({ includeEmpty: true }, (row, r) => {
      if (row.hidden) hiddenRows.push(r);
      row.eachCell({ includeEmpty: false }, (c) => {
        const v = c.value;
        if (v === null || v === undefined) return;
        if (c.isMerged && c.master && c.master.address !== c.address) return; // merged: only the top-left cell holds the value
        const e = {};
        const f = c.formula || (v && typeof v === 'object' && (v.formula || v.sharedFormula) ? c.formula : null);
        if (f) e.f = f; // the app works the result out itself (lib/wbEngine.js), the same way as Excel
        else e.v = plain(v);
        const st = c.style || {};
        if (c.numFmt && c.numFmt !== 'General') e.n = c.numFmt;
        if (st.font && st.font.bold) e.b = 1;
        const fg = st.fill && st.fill.type === 'pattern' && st.fill.pattern === 'solid' ? colorOf(st.fill.fgColor) : null;
        if (fg && fg !== 'FFFFFF' && !(st.fill.fgColor.argb && /^00/.test(st.fill.fgColor.argb))) e.bg = fg;
        const h = st.alignment && st.alignment.horizontal;
        if (h === 'center' || h === 'right' || h === 'centerContinuous') e.al = h[0];
        if (st.alignment && st.alignment.wrapText) e.w = 1;
        const v2 = st.alignment && st.alignment.vertical;
        if (v2 === 'middle' || v2 === 'center') e.va = 'm';
        const fnt = st.font || {};
        if (fnt.size && fnt.size !== 11) e.fs = fnt.size;
        const col = colorOf(fnt.color);
        if (col && col !== '000000') e.fc = col;
        if (fnt.name && !/^(calibri|aptos narrow|aptos)$/i.test(fnt.name)) e.fn = fnt.name;
        if (fnt.italic) e.i = 1;
        if (fnt.underline) e.u = 1;
        const bd = st.border || {};
        const sides = ['top', 'right', 'bottom', 'left'].map((k) => (bd[k] && bd[k].style ? (bd[k].style === 'medium' || bd[k].style === 'thick' || bd[k].style === 'double' ? '2' : '1') : '0')).join('');
        if (sides !== '0000') e.bd = sides;
        cells[c.address] = e;
      });
    });
    const cols = {}; const hiddenCols = [];
    (ws.columns || []).slice(0, Math.max(ws.columnCount || 0, 1)).forEach((col, i) => {
      const L = col.letter || String.fromCharCode(65 + i);
      if (col.width) cols[L] = Math.round(col.width * 10) / 10;
      if (col.hidden) hiddenCols.push(L);
    });
    const rowH = {};
    for (let r = 1; r <= ws.rowCount; r++) { const h = ws.getRow(r).height; if (h) rowH[r] = Math.round(h * 10) / 10; }
    // pictures at the top of the sheet (the company logo) are kept; pictures lower down (stamp, signature) are not:
    // on the papers they are added with ⬆ Upload or ✍ Draw (Owner 11 Nov 2026)
    const images = [];
    try {
      (ws.getImages() || []).forEach((im) => {
        const tl = im.range && im.range.tl; if (!tl) return;
        const row = Math.floor(tl.nativeRow !== undefined ? tl.nativeRow : tl.row);
        const colI = Math.floor(tl.nativeCol !== undefined ? tl.nativeCol : tl.col);
        const media = wb.getImage(Number(im.imageId));
        if (!media || !media.buffer || row > 10 && !(row >= 38 && row <= 40)) return;
        if (images.some((x) => x.row === row + 1 && x.col === colI + 1)) return;
        const ext = String(media.extension || 'png').replace('jpg', 'jpeg');
        const id = `img${im.imageId}`;
        if (!media_[id]) media_[id] = `data:image/${ext};base64,${toB64(media.buffer)}`;
        const w = im.range.ext ? Math.round(im.range.ext.width) : null; const h = im.range.ext ? Math.round(im.range.ext.height) : null;
        images.push({ row: row + 1, col: colI + 1, w, h, m: id });
      });
    } catch { /* no pictures */ }
    const merges = Object.keys((ws._merges) || {}).map((k) => ws._merges[k].range || ws._merges[k].tl + ':' + ws._merges[k].br).filter(Boolean);
        let printArea = (ws.pageSetup && ws.pageSetup.printArea) || '';
    printArea = String(printArea).split(',')[0].replace(/\$/g, '').replace(/^.*!/, '');
    sheets.push({ name: ws.name, cells, cols, rowH, merges, hiddenRows, hiddenCols, images, printArea, maxRow: ws.rowCount, maxCol: ws.columnCount });
  });
  return { sheets, media: media_ };
}
