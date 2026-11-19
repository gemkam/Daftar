/*
  Ali Pack workbooks: Excel formula engine (fast-formula-parser, MIT).
  Each workbook is kept as the Excel had it: every cell's typed value or its formula (same text as in Excel).
  The app works the formulas out the same way Excel does: nothing is changed or added.
  book = [{ name, cells: { A1: { v } | { f, c } , ... } }]   v = typed value, f = formula (no "="), c = Excel's last result
  Dates are kept as Excel day numbers ({ d: 46000 }).
*/
import FormulaParser from 'fast-formula-parser';
const { FormulaError, FormulaHelpers: H, Types } = FormulaParser;

/* MATCH is missing in the engine: written here the way Excel does it.
   type 0 = exact (text not case sensitive, * and ? wildcards), 1 = largest value <= lookup (sorted up), -1 = smallest value >= lookup (sorted down) */
/* INDEX written here too: the engine's INDEX loses the sheet name (it read 'Sales Ledger'!F2:F106 from the wrong sheet) */
function INDEX(range, rowNum, colNum) {
  let arr = range.value;
  if (!Array.isArray(arr)) arr = [[arr]];
  const r = Math.trunc(H.accept(rowNum, Types.NUMBER));
  const c = colNum === undefined || colNum === null ? 1 : Math.trunc(H.accept(colNum, Types.NUMBER, 1));
  let rr = r; let cc = c;
  if (arr.length === 1 && (colNum === undefined || colNum === null)) { rr = 1; cc = r; } // one row: INDEX(row, n)
  if (rr < 1 || cc < 1 || rr > arr.length || cc > (arr[0] || []).length) throw FormulaError.REF;
  const v = arr[rr - 1][cc - 1];
  return v === null || v === undefined ? 0 : v;
}

function MATCH(lookup, range, type) {
  const want = H.accept(lookup);
  const t = type === undefined || type === null ? 1 : H.accept(type, Types.NUMBER, 1);
  let arr = range.value;
  if (!Array.isArray(arr)) arr = [[arr]];
  const flat = arr.length === 1 ? arr[0] : arr.map((r) => r[0]);
  const same = (a, b) => {
    if (typeof a === 'string' && typeof b === 'string') {
      if (/[*?]/.test(b)) {
        const re = new RegExp(`^${b.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
        return re.test(a);
      }
      return a.toLowerCase() === b.toLowerCase();
    }
    return typeof a === typeof b && a === b;
  };
  if (Number(t) === 0) {
    for (let i = 0; i < flat.length; i++) if (flat[i] !== null && flat[i] !== undefined && same(flat[i], want)) return i + 1;
    throw FormulaError.NA;
  }
  let pos = -1;
  for (let i = 0; i < flat.length; i++) {
    const v = flat[i];
    if (v === null || v === undefined || typeof v !== typeof want) continue;
    if (Number(t) > 0 ? v <= want : v >= want) pos = i; else break;
  }
  if (pos < 0) throw FormulaError.NA;
  return pos + 1;
}

const colNum = (s) => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colStr = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const split = (a) => { const m = /^([A-Z]+)(\d+)$/.exec(a); return m ? { col: colNum(m[1]), row: Number(m[2]) } : null; };
const addr = (row, col) => `${colStr(col)}${row}`;

function raw(v) {
  if (v && typeof v === 'object' && 'd' in v) return v.d;
  return v === undefined ? null : v;
}

/* the engine's own INDEX is replaced by ours (outside of text in quotes) */
const prepCache = new Map();
function prep(f) {
  if (prepCache.has(f)) return prepCache.get(f);
  const out = f.split('"').map((part, i) => (i % 2 ? part : part.replace(/(^|[^A-Za-z0-9_.])INDEX\(/gi, '$1XINDEX('))).join('"');
  prepCache.set(f, out);
  return out;
}

export function makeEngine(book) {
  const byName = {};
  book.forEach((s) => { byName[s.name.toLowerCase()] = s; });
  let cache = new Map();
  const busy = new Set();
  const newParser = () => new FormulaParser({
    functions: { MATCH, XINDEX: INDEX },
    onCell: ({ sheet, row, col }) => value(sheet, addr(row, col)),
    onRange: (ref) => {
      const s = byName[String(ref.sheet).toLowerCase()];
      const out = [];
      const toRow = Math.min(ref.to.row, s ? s.maxRow || ref.to.row : ref.to.row);
      for (let r = ref.from.row; r <= toRow; r++) {
        const line = [];
        for (let c = ref.from.col; c <= ref.to.col; c++) line.push(value(ref.sheet, addr(r, c)));
        out.push(line);
      }
      // keep the full height asked for (empty rows) so INDEX / MATCH positions stay the same as Excel
      for (let r = toRow + 1; r <= ref.to.row; r++) out.push(new Array(ref.to.col - ref.from.col + 1).fill(null));
      return out;
    }
  });
  // the parser cannot run inside itself, so one parser per depth (a formula reading another formula)
  const parsers = [];
  let depth = 0;
  function value(sheetName, a) {
    const s = byName[String(sheetName).toLowerCase()];
    if (!s) return FormulaError.REF;
    const cell = s.cells[a];
    if (!cell) return null;
    if (cell.f === undefined) {
      const v = raw(cell.v);
      return typeof v === 'string' && v.trim() === '' ? v : v;
    }
    const k = `${s.name}!${a}`;
    if (cache.has(k)) return cache.get(k);
    if (busy.has(k)) return FormulaError.REF; // circular
    busy.add(k);
    let r;
    const p = split(a);
    try {
      if (!parsers[depth]) parsers[depth] = newParser();
      const parser = parsers[depth];
      depth++;
      try { r = parser.parse(prep(cell.f), { sheet: s.name, row: p.row, col: p.col }); } finally { depth--; }
      if (Array.isArray(r)) r = Array.isArray(r[0]) ? r[0][0] : r[0];
    } catch (e) {
      r = e instanceof FormulaError ? e : FormulaError.VALUE;
    }
    busy.delete(k);
    if (r === undefined || r === null) r = 0; // like Excel: a formula pointing at an empty cell shows 0
    cache.set(k, r);
    return r;
  }
  return {
    value,
    reset() { cache = new Map(); },
    isError: (v) => v instanceof FormulaError,
    errText: (v) => (v instanceof FormulaError ? v.toString() : '')
  };
}

export { colNum, colStr, split, addr };
