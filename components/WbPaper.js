'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import SignStamp from '@/components/SignStamp';
import { colStr, rangeOf, colPx, rowPx, showValue, editText, usedSize } from '@/lib/wbBooks';

/*
  🦁 Ali Pack document tabs (Quotation, Invoice, Purchase Order (AED), Delivery Note) shown as the printed paper:
  the Excel's print area with its fonts, colours, borders, merged cells, row heights, hidden rows and logo.
  ✏️ Edit: click a cell on the paper and type (customer, PI No., discount ...). Stamp / signature next to "Authorized Signatory".
  13 Nov 2026 (Owner): a formula is never shown. Cells worked out by a formula cannot be typed in on the paper:
  clicking one says where it comes from (e.g. items, quantity, price come from the Costing tab). No hover tooltips.
*/
const SHEET_LINK = /(?:'([^']+)'|\b([A-Za-z_]\w*))!\$?[A-Z]+\$?\d+/;
const fromWhere = (f) => { const m = String(f || '').match(SHEET_LINK); return m ? (m[1] || m[2]).trim() : ''; };
export default function WbPaper({ sheet, tab, eng, media, canEdit, setCells, signs, setSigns, flash }) {
  const [edit, setEdit] = useState(null);
  const inputRef = useRef(null);
  const skip = useRef(false);
  useEffect(() => { setEdit(null); }, [tab]);
  useEffect(() => { if (edit) inputRef.current?.focus(); }, [edit?.r, edit?.c]); // eslint-disable-line react-hooks/exhaustive-deps

  const L = useMemo(() => {
    const size = usedSize(sheet);
    let r1 = 1; let c1 = 1; let r2 = size.rows; let c2 = size.cols;
    const p = rangeOf(sheet.printArea); if (p) ({ r1, c1, r2, c2 } = p);
    const hr = new Set(sheet.hiddenRows || []); const hc = new Set(sheet.hiddenCols || []);
    const rows = []; const cols = [];
    for (let r = r1; r <= r2; r++) if (!hr.has(r)) rows.push(r);
    for (let c = c1; c <= c2; c++) if (!hc.has(colStr(c))) cols.push(c);
    const span = {}; const skipCells = new Set();
    (sheet.merges || []).forEach((m) => {
      const g = rangeOf(m); if (!g) return;
      span[`${g.r1}:${g.c1}`] = { rs: Math.max(1, rows.filter((r) => r >= g.r1 && r <= g.r2).length), cs: Math.max(1, cols.filter((c) => c >= g.c1 && c <= g.c2).length) };
      for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) if (r !== g.r1 || c !== g.c1) skipCells.add(`${r}:${c}`);
    });
    const widths = cols.map((c) => colPx(sheet.cols?.[colStr(c)]));
    const signRow = rows.find((r) => String(sheet.cells?.[`A${r}`]?.v || '').trim() === 'Authorized Signatory');
    return { rows, cols, span, skipCells, widths, total: widths.reduce((a, b) => a + b, 0), signRow };
  }, [sheet]);

  function commit() {
    if (!edit) return;
    const a = `${colStr(edit.c)}${edit.r}`;
    if (editText(sheet.cells?.[a]) !== edit.text) setCells({ [a]: edit.text }, 'text');
    setEdit(null);
  }

  return (
    <div className="wb-wrap wb-paper-wrap wb-print" style={{ '--wb-zoom': Math.min(1, 720 / L.total) }}>
      {canEdit && <p className="muted wb-noprint" style={{ margin: '0 0 10px', textAlign: 'center' }}>Click a white cell and type (customer, PI No., notes). Items, quantities and prices fill themselves from the 🧮 Costing tab: type them there.</p>}
      <table className="wb-grid wb-paper" style={{ width: L.total }}>
        <colgroup>{L.widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <tbody>
          {L.rows.map((r) => (
            <tr key={r} style={{ height: rowPx(sheet.rowH?.[r]) }}>
              {L.cols.map((c, ci) => {
                const k = `${r}:${c}`;
                if (L.skipCells.has(k)) return null;
                const a = `${colStr(c)}${r}`;
                const e = sheet.cells?.[a];
                const sp = L.span[k];
                const v = e ? (e.f !== undefined ? eng.value(tab, a) : e.v) : null;
                const txt = e ? showValue(v, e.n, eng) : '';
                const num = typeof v === 'number' || (v && typeof v === 'object' && 'd' in v);
                const err = eng.isError(v) && txt !== '–';
                const nc = L.cols[ci + 1];
                const ne = nc && !sheet.cells?.[`${colStr(nc)}${r}`];
                const spill = !!txt && !num && !e?.w && !sp && ne && (!e?.al || e.al === 'l');
                const st = {};
                if (e?.bg) st.background = `#${e.bg}`;
                if (e?.bd) {
                  const w = (x) => (x === '2' ? '2px solid #000' : x === '1' ? '1px solid #000' : undefined);
                  const [t, rr, b, l] = e.bd.split('');
                  if (w(t)) st.borderTop = w(t); if (w(rr)) st.borderRight = w(rr); if (w(b)) st.borderBottom = w(b); if (w(l)) st.borderLeft = w(l);
                }
                const inner = {
                  fontWeight: e?.b ? 700 : undefined, fontStyle: e?.i ? 'italic' : undefined, textDecoration: e?.u ? 'underline' : undefined,
                  fontSize: e?.fs ? `${e.fs}pt` : undefined, fontFamily: e?.fn ? `"${e.fn}", Arial, sans-serif` : undefined,
                  color: err ? '#c62828' : e?.fc ? `#${e.fc}` : undefined,
                  textAlign: e?.al === 'c' ? 'center' : e?.al === 'r' ? 'right' : num ? 'right' : 'left',
                  whiteSpace: e?.w ? 'pre-wrap' : 'pre', overflow: spill ? 'visible' : 'hidden'
                };
                const isEdit = edit && edit.r === r && edit.c === c;
                // 13 Nov 2026 (Owner): only places with something written or a box of the paper's tables can be typed in;
                // the empty white area of the paper cannot
                const typeable = !!e && e.f === undefined && (String(e.v ?? '').trim() !== '' || !!e.bd || !!e.bg);
                const imgs = (sheet.images || []).filter((im) => im.row === r && im.col === c);
                return (
                  <td key={c} rowSpan={sp?.rs} colSpan={sp?.cs} style={st}
                    className={`${e?.va ? 'wb-mid' : ''}${canEdit && (typeable || e?.f !== undefined) ? ' wb-can' : ''}${canEdit && e?.f !== undefined ? ' wb-fcell' : ''}`}
                    onClick={() => {
                      if (!canEdit || isEdit) return;
                      if (e?.f !== undefined) {
                        const src = fromWhere(e.f);
                        flash?.(src ? `This fills itself from the ${src} tab. Type it there.` : 'This is worked out by itself (totals, VAT, date).', 'err');
                        return;
                      }
                      if (!typeable) return;
                      setEdit({ r, c, text: editText(e) });
                    }}>
                    {isEdit ? (
                      <input ref={inputRef} className="wt-in" value={edit.text} onChange={(ev) => setEdit({ ...edit, text: ev.target.value })}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') { ev.preventDefault(); skip.current = true; commit(); skip.current = false; }
                          if (ev.key === 'Escape') { ev.preventDefault(); skip.current = true; setEdit(null); skip.current = false; }
                        }}
                        onBlur={() => { if (!skip.current) commit(); }} />
                    ) : <div className="wb-c" style={inner}>{txt}</div>}
                    {imgs.map((im, i) => <img key={i} className="wb-img" src={media?.[im.m]} alt="" style={{ width: im.w || 160, height: im.h || 150 }} />)}
                    {L.signRow && r === L.signRow && ci === 1 && (
                      <div className="wb-sign" onClick={(ev) => ev.stopPropagation()}>
                        <SignStamp value={signs} onChange={canEdit ? setSigns : null} flash={flash} />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
