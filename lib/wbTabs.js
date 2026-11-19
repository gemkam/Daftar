/* 🦁 Ali Pack workbooks: the two Excel files and their tabs (light file, no formula engine: used by the company tiles) */
export const BOOKS = [
  {
    key: 'quotation', title: 'Quotation Management', file: 'Quotation_Management_Template.xlsx', ico: '📑',
    tabs: ['Costing', 'Purchase Order (AED)', 'Delivery Note', 'Quotation', 'ReferenceCosting', 'Invoice', 'Staff Price List']
  },
  {
    key: 'accounts', title: 'Running Accounts', file: 'Running_Accounts_-_APMD.xlsx', ico: '📒',
    tabs: ['Bank statement', 'Card Statement', 'Operating Expenses', 'Company Assets', 'Purchase Ledger', 'Sales Ledger', 'Quotation Tracker']
  }
];
export const TAB_ICON = {
  Costing: '🧮', 'Purchase Order (AED)': '🛒', 'Delivery Note': '🚚', Quotation: '📝', ReferenceCosting: '📋', Invoice: '🧾', 'Staff Price List': '🏷️',
  'Bank statement': '🏦', 'Card Statement': '💳', 'Operating Expenses': '💸', 'Company Assets': '🚗', 'Purchase Ledger': '📥', 'Sales Ledger': '📤', 'Quotation Tracker': '📈'
};
/*
  Buttons inside buttons (Owner 13 Nov 2026): a tab that fills itself from another tab sits inside that tab's button.
  From the Excel formulas: Quotation, Purchase Order (AED) and Invoice take items, quantities and prices from Costing;
  Delivery Note takes them from Quotation. Top row = tabs with no parent here.
*/
export const TAB_PARENT = { Quotation: 'Costing', 'Purchase Order (AED)': 'Costing', Invoice: 'Costing', 'Delivery Note': 'Quotation' };
export const rootTabs = (book) => (book?.tabs || []).filter((t) => !TAB_PARENT[t] || !book.tabs.includes(TAB_PARENT[t]));
export const childTabs = (book, t) => (book?.tabs || []).filter((x) => TAB_PARENT[x] === t);
export const tabPath = (t) => { const p = []; let x = t; while (x) { p.unshift(x); x = TAB_PARENT[x]; } return p; };
export const bookOfTab = (tab) => BOOKS.find((b) => b.tabs.includes(tab)) || null;
export const tabHref = (tab) => `/alipack?tab=${encodeURIComponent(tab)}`;
export const bookHref = (key) => `/alipack?book=${key}`;

/*
  How each tab is shown (Owner 11 Nov 2026: "each tab is a button, inside it a table with the same calculations").
  Only the layout is set here; every value and calculation comes from the Excel cells themselves.
  kind 'table': header = row 1, cols = columns of the table, from = first data row,
    to = last data row (fixed tabs) or open (rows with something typed are shown, ＋ Add row adds the next one),
    fixed = always show rows from..to (Costing: the 9 lines that feed the Quotation),
    footer = total rows under the table, settings = small label / value rows (rates), side = boxes beside the table.
  kind 'paper': the printed document (Quotation, Invoice, Purchase Order, Delivery Note).
*/
export const LAYOUT = {
  // heads: name for a column that has no heading in the Excel (13 Nov 2026, instead of "Column Q")
  Costing: { kind: 'table', cols: 'A:Q', from: 3, to: 11, fixed: true, footer: [13, 14], settings: [20, 21, 22], heads: { Q: 'Margin %' } },
  'Purchase Order (AED)': { kind: 'paper' },
  'Delivery Note': { kind: 'paper' },
  Quotation: { kind: 'paper' },
  ReferenceCosting: { kind: 'table', cols: 'A:T', from: 3, to: 117, footer: [119, 120, 122, 124], settings: [126, 127], heads: { R: 'Margin %', T: 'Cost Difference (AED)' } },
  Invoice: { kind: 'paper' },
  'Staff Price List': { kind: 'table', cols: 'A:G', from: 3 },
  'Bank statement': { kind: 'table', cols: 'A:F', from: 2, add: true },
  'Card Statement': { kind: 'table', cols: 'A:F', from: 2, add: true },
  'Operating Expenses': { kind: 'table', cols: 'A:F', from: 2, add: true },
  'Company Assets': { kind: 'table', cols: 'A:D', from: 2, add: true },
  'Purchase Ledger': { kind: 'table', cols: 'A:M', from: 2, add: true },
  'Sales Ledger': { kind: 'table', cols: 'A:U', from: 2, add: true },
  'Quotation Tracker': { kind: 'table', cols: 'A:J', from: 2, add: true, side: 'tracker', heads: { I: 'Sales Ledger Value', J: 'Matches Sales Ledger' } }
};
/*
  Summary boxes on top of each table, like the Bills page (Owner 11 Nov 2026: "I need like this one in Ali Pack too").
  Only plain totals of the table's own columns for the rows shown (follow the ▾ filters): sum = add the column,
  last = value on the last row shown (running Balance), count = number of rows shown. omr = show with the Rial sign.
*/
export const CARDS = {
  Costing: [{ label: '🧮 Total Cost (OMR)', cols: ['N'], omr: true }, { label: '💰 Total Sales (OMR)', cols: ['O'], omr: true }, { label: '📈 Margin (OMR)', cols: ['P'], omr: true }],
  ReferenceCosting: [{ label: '🧮 Total Cost (OMR)', cols: ['O'], omr: true }, { label: '💰 Total Sales (OMR)', cols: ['P'], omr: true }, { label: '📈 Margin (OMR)', cols: ['Q'], omr: true }],
  'Staff Price List': [{ label: '🏷️ Items', how: 'count' }, { label: '💰 Total Sales (OMR)', cols: ['G'], omr: true }],
  'Bank statement': [{ label: '⬇️ In', cols: ['D'], omr: true }, { label: '⬆️ Out', cols: ['E'], omr: true }, { label: '🏦 Balance', cols: ['F'], how: 'last', omr: true, sub: 'On the last row shown' }],
  'Card Statement': [{ label: '⬇️ In', cols: ['D'], omr: true }, { label: '⬆️ Out', cols: ['E'], omr: true }, { label: '💳 Balance', cols: ['F'], how: 'last', omr: true, sub: 'On the last row shown' }],
  'Operating Expenses': [{ label: '💸 Debit', cols: ['C'], omr: true }, { label: '🧾 VAT Element', cols: ['E'], omr: true }, { label: '🧮 Total Expense', cols: ['F'], omr: true }],
  'Company Assets': [{ label: '🚗 Assets', how: 'count' }, { label: '💰 Value', cols: ['C'], omr: true }],
  'Purchase Ledger': [{ label: '📥 Purchases', how: 'count' }, { label: '💵 Payments (OMR)', cols: ['I', 'K'], omr: true, sub: 'Both Payment Amount (OMR) columns' }],
  'Sales Ledger': [{ label: '📤 Invoice Value (incl VAT)', cols: ['F'], omr: true }, { label: '🧾 VAT', cols: ['G'], omr: true }, { label: '⏳ Balance Outstanding', cols: ['R'], omr: true }, { label: '📈 Rough Profit', cols: ['S'], omr: true }],
  'Quotation Tracker': [{ label: '📈 Quotations', how: 'count' }, { label: '💰 Invoice Value', cols: ['F'], omr: true }]
};

export const layoutOf = (tab) => LAYOUT[tab] || { kind: 'table', cols: '', from: 2, add: true };

