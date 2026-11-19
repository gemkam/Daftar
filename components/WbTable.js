'use client';

import { useMemo } from 'react';
import DataGrid from '@/components/DataGrid';
import { colStr, colNum, colPx, showValue, editText, usedSize, shiftFormula } from '@/lib/wbBooks';

/*
  🦁 One Ali Pack Excel tab as a TABLE (Owner 11 Nov 2026).
  Looks and works like every other table in the app (components/DataGrid.js, same as the Bills table):
  "make all the tables like this in Ali Pack ... not like Excel style table".
  - Column names from row 1, one table row per Excel row, every calculated cell worked out from the Excel's
    own formulas (lib/wbEngine.js). Nothing added. Excel colours / fonts are not used (app theme instead).
  - ▾ on each column name: sort and filter (view only), Table / Cards switch, ‹ › to move wide tables.
  - ✏️ Edit: click a cell and type (=formula, number, date dd/mm/yyyy, text). Calculated cells cannot be typed in.
  - + Add new row: the next Excel row. Columns the Excel fills down (same formula row after row) get their formula,
    moved one row down like Excel's fill down. One-off formulas typed by hand on a row are NOT copied.
  - Totals rows of the Excel (Costing, ReferenceCosting) show as the table's Σ rows.
*/
const colRange = (ref) => { const m = /^([A-Z]+):([A-Z]+)$/.exec(String(ref || '')); return m ? { c1: colNum(m[1]), c2: colNum(m[2]) } : null; };
const typed = (e) => e && e.f === undefined && e.v !== null && e.v !== undefined && !(typeof e.v === 'string' && e.v.trim() === '');
const isNum = (v) => typeof v === 'number' || (v && typeof v === 'object' && 'd' in v);
const numOf = (v) => (v && typeof v === 'object' && 'd' in v ? v.d : v);

export default function WbTable({ sheet, tab, eng, layout, canEdit, setCells, extraRows = [], onAddRow, showHidden = false, flash, onView }) {
  const cells = sheet.cells || {};

  const allCols = useMemo(() => {
    const g = colRange(layout.cols) || { c1: 1, c2: usedSize(sheet).cols };
    const o = []; for (let c = g.c1; c <= g.c2; c++) o.push(c);
    return o;
  }, [layout.cols, sheet]);
  const cols = useMemo(() => {
    const hc = new Set(showHidden ? [] : sheet.hiddenCols || []);
    return allCols.filter((c) => !hc.has(colStr(c)));
  }, [allCols, sheet, showHidden]);

  const head = (c) => {
    const e = cells[`${colStr(c)}1`];
    const t = e ? String(e.f !== undefined ? showValue(eng.value(tab, `${colStr(c)}1`), e.n, eng) : e.v ?? '').trim() : '';
    return t || layout.heads?.[colStr(c)] || `Column ${colStr(c)}`;
  };

  /* data rows: rows with something typed in the table's columns (fixed tabs: always from..to) */
  const rowNos = useMemo(() => {
    const from = layout.from || 2;
    const skipRows = new Set([...(layout.footer || []), ...(layout.settings || [])]);
    if (layout.fixed) { const o = []; for (let r = from; r <= layout.to; r++) o.push(r); return o; }
    const last = layout.to || usedSize(sheet).rows;
    const set = new Set();
    for (let r = from; r <= last; r++) {
      if (skipRows.has(r)) continue;
      if (allCols.some((c) => typed(cells[`${colStr(c)}${r}`]))) set.add(r);
    }
    extraRows.forEach((r) => set.add(r));
    return [...set].sort((a, b) => a - b);
  }, [sheet, layout, allCols, extraRows, cells]);

  const val = (r, c) => {
    const a = `${colStr(c)}${r}`;
    const e = cells[a];
    if (!e) return { v: null, t: '', e };
    const v = e.f !== undefined ? eng.value(tab, a) : e.v;
    return { v, t: showValue(v, e.n, eng), e };
  };

  const show = (r, c) => {
    const { v, t, e } = val(r, c);
    // no formula shown on hover (13 Nov 2026, Owner)
    if (eng.isError(v) && t !== '–') return <span className="wt-err">{t}</span>;
    return t;
  };

  /* the table's columns (one per Excel column) */
  const columns = useMemo(() => cols.map((c) => {
    const L = colStr(c);
    let n = 0; let all = 0;
    rowNos.forEach((r) => { const { v } = val(r, c); if (v !== null && v !== undefined && v !== '') { all++; if (isNum(v)) n++; } });
    const w = sheet.cols?.[L];
    return {
      key: L,
      label: head(c),
      type: 'text',
      align: all && n / all > 0.6 ? 'right' : 'left',
      width: Math.max(90, Math.min(260, colPx(w))),
      render: (row) => show(row.id, c),
      raw: (row) => editText(cells[`${L}${row.id}`]),
      editable: (row) => cells[`${L}${row.id}`]?.f === undefined,
      text: (row) => val(row.id, c).t,
      sortValue: (row) => { const x = numOf(val(row.id, c).v); return typeof x === 'number' ? x : String(x ?? '').toLowerCase(); }
    };
  }), [cols, rowNos, sheet, eng, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => rowNos.map((r) => ({ id: r })), [rowNos]);

  const footer = (layout.footer || []).length
    ? layout.footer.map((r) => Object.fromEntries(cols.map((c) => [colStr(c), show(r, c)])))
    : null;

  function onSave(row, key, value) {
    setCells({ [`${key}${row.id}`]: value ?? '' }, 'text');
  }

  /* + Add new row: next Excel row after the last row, formulas of fill-down columns copied one row down */
  function addRow() {
    const last = rowNos.length ? rowNos[rowNos.length - 1] : (layout.from || 2) - 1;
    const r = last + 1;
    const add = {};
    allCols.forEach((c) => {
      const L = colStr(c);
      if (cells[`${L}${r}`]) return; // the Excel already has this cell (formula filled down in advance)
      const a = cells[`${L}${last}`]; const b = cells[`${L}${last - 1}`];
      if (a?.f !== undefined && b?.f !== undefined && shiftFormula(b.f, 1) === a.f) {
        add[`${L}${r}`] = { ...a, f: shiftFormula(a.f, 1) };
      } else if (a && a.n) {
        add[`${L}${r}`] = { n: a.n }; // same number / date format as the row above, empty
      }
    });
    if (Object.keys(add).length) setCells(add, 'cell');
    onAddRow(r);
    flash?.('New row added at the end. Type in it; calculated columns fill by themselves.');
  }

  const labelOf = (r) => {
    for (const c of allCols) { const e = cells[`${colStr(c)}${r}`]; if (typed(e) && typeof e.v === 'string') return e.v.trim(); }
    return '';
  };

  /* rates used by the calculations (Costing, ReferenceCosting) */
  const rates = (layout.settings || []).map((r) => {
    const vc = allCols.find((c) => { const e = cells[`${colStr(c)}${r}`]; return e && (typeof e.v === 'number' || e.f !== undefined); });
    return { id: r, label: labelOf(r), vc };
  });

  return (
    <div className="wb-print">
      <DataGrid
        columns={columns}
        rows={rows}
        canEdit={canEdit}
        onSave={onSave}
        onAdd={layout.add ? addRow : undefined}
        footer={footer}
        flash={flash}
        onView={onView}
        emptyText="No rows yet."
      />
      {rates.length > 0 && (
        <div className="wt-settings">
          <div className="wt-cap">Rates used by the calculations</div>
          <DataGrid
            filters={false}
            canEdit={canEdit}
            rows={rates}
            columns={[
              { key: 'label', label: 'Rate', readOnly: true, width: 220 },
              {
                key: 'value', label: 'Value', type: 'text', align: 'right', width: 140,
                render: (row) => (row.vc ? show(row.id, row.vc) : ''),
                raw: (row) => (row.vc ? editText(cells[`${colStr(row.vc)}${row.id}`]) : ''),
                editable: (row) => !!row.vc && cells[`${colStr(row.vc)}${row.id}`]?.f === undefined
              }
            ]}
            onSave={(row, key, value) => { if (row.vc) setCells({ [`${colStr(row.vc)}${row.id}`]: value ?? '' }, 'text'); }}
          />
        </div>
      )}
      {layout.side === 'tracker' && <TrackerSide sheet={sheet} eng={eng} tab={tab} rows={rowNos} show={show} />}
    </div>
  );
}

/* Quotation Tracker: the Excel's status count (K2:L4, its own COUNTIF formulas) and its pivot table
   "Sum of Invoice Value by Month Issued and Status", worked out live from the same rows (a pivot is not a formula in Excel). */
function TrackerSide({ sheet, eng, tab, rows, show }) {
  const cells = sheet.cells || {};
  const countRows = [];
  for (let r = 1; r <= 10; r++) if (cells[`K${r}`] && cells[`L${r}`]?.f !== undefined) countRows.push(r);
  const piv = useMemo(() => {
    const m = {}; const st = new Set();
    rows.forEach((r) => {
      const month = showValue(eng.value(tab, `C${r}`), cells[`C${r}`]?.n, eng);
      const s = String(cells[`G${r}`]?.v ?? '').trim() || '(blank)';
      const f = cells[`F${r}`];
      const v = f ? (f.f !== undefined ? eng.value(tab, `F${r}`) : f.v) : 0;
      st.add(s);
      m[month] = m[month] || {};
      m[month][s] = (m[month][s] || 0) + (typeof v === 'number' ? v : 0);
    });
    const statuses = [...st].sort((a, b) => (a === '(blank)') - (b === '(blank)') || a.localeCompare(b));
    const key = (x) => { const p = /^(\d{2})-(\d{4})$/.exec(x); return p ? `${p[2]}-${p[1]}` : `~${x}`; };
    const months = Object.keys(m).sort((a, b) => key(a).localeCompare(key(b)));
    return { m, statuses, months };
  }, [rows, sheet, eng]); // eslint-disable-line react-hooks/exhaustive-deps
  const f3 = (x) => (x ? x.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '');
  const rowTotal = (mo) => piv.statuses.reduce((t, s) => t + (piv.m[mo][s] || 0), 0);
  const colTotal = (s) => piv.months.reduce((t, mo) => t + (piv.m[mo][s] || 0), 0);
  const L = colNum('L');

  const pivCols = [
    { key: 'month', label: 'Month Issued', type: 'calc', width: 120, align: 'left', text: (r) => r.month, render: (r) => r.month },
    ...piv.statuses.map((s) => ({ key: `s_${s}`, label: s, type: 'calc', width: 120, render: (r) => f3(piv.m[r.month][s]) })),
    { key: 'total', label: 'Grand Total', type: 'calc', width: 130, render: (r) => <b>{f3(rowTotal(r.month))}</b> }
  ];
  const pivFoot = { month: 'Grand Total', total: f3(piv.months.reduce((t, mo) => t + rowTotal(mo), 0)) };
  piv.statuses.forEach((s) => { pivFoot[`s_${s}`] = f3(colTotal(s)); });

  return (
    <div className="wt-side">
      <div className="wt-settings">
        <div className="wt-cap">Count by status</div>
        <DataGrid filters={false} canEdit={false} rows={countRows.map((r) => ({ id: r }))}
          columns={[
            { key: 'status', label: 'Status', type: 'calc', align: 'left', width: 160, render: (row) => String(cells[`K${row.id}`].v) },
            { key: 'count', label: 'Count', type: 'calc', width: 100, render: (row) => show(row.id, L) }
          ]} />
      </div>
      <div className="wt-settings">
        <div className="wt-cap">Sum of Invoice Value by Month Issued and Status</div>
        <DataGrid filters={false} canEdit={false} rows={piv.months.map((mo) => ({ id: mo, month: mo }))} columns={pivCols} footer={pivFoot} />
      </div>
    </div>
  );
}
