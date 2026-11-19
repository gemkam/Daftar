// Office expense (Sahil Technical Services LLC) helpers
export const EXP_COMPANY = 'SAHIL TECHNICAL SERVICES L.L.C';

/* The companies inside Office Expense (switch at the top of the page) */
export const COMPANIES = [
  { key: 'al-noor', short: 'Al Noor', name: 'AL NOOR LOGISTICS AND TRADING L.L.C', logo: '/al-noor-logo.svg', cr: 'CR: 1000001', address: 'P.O. Box 100, PC 112, Ruwi, Muscat, Sultanate of Oman' },
  { key: 'sahil', short: 'Sahil', name: 'SAHIL TECHNICAL SERVICES L.L.C', logo: '/sahil-logo.svg', cr: 'CR: 1000002', address: 'P.O. Box 200, PC 130, Al Azaiba, Muscat, Sultanate of Oman' }
];
export const companyOf = (key) => COMPANIES.find((c) => c.key === key) || COMPANIES[0];

/* ＋ Add company (1 Nov 2026): companies added by the office are kept in table personnel_companies and joined to
   COMPANIES once after login (components/AuthGate.js), so every page that lists COMPANIES shows them too. */
export function addCompanies(rows = []) {
  rows.forEach((r) => {
    if (!r?.key || COMPANIES.some((c) => c.key === r.key)) return;
    COMPANIES.push({ key: r.key, short: r.short, name: r.name || String(r.short || '').toUpperCase(), logo: r.logo || '', cr: r.cr ? (/^cr/i.test(r.cr) ? r.cr : `CR: ${r.cr}`) : '', address: r.address || '', added: true });
  });
}
let loaded = null;
export function loadAddedCompanies(supabase) {
  if (!loaded) loaded = supabase.from('personnel_companies').select('*').order('sort').order('created_at').then(({ data }) => { addCompanies(data || []); }).catch(() => {});
  return loaded;
}

export const HEADS = [
  'Entertainment',
  'Govt Fees, Registration and Renewals',
  'IT, Mobile and Computer',
  'Marketing',
  'Mobile Telephone and Internet',
  'Office Expenses',
  'Salary',
  'Utility',
  'Vehicle Running and Maintenance'
];

export const CATEGORIES = ['Food', 'Water', 'Documentation', 'Electronics', 'Marketing', 'Sponsorship', 'Cards', 'Mobile', 'Mobile Service', 'Internet',
  'Stationary', 'Office', 'Office Expense', 'Building Material', 'Furniture', 'Utensils', 'Service', 'Contract', 'Misc', 'Salary', 'Utility', 'Petrol', 'Car', 'Car service'];

/* Departments inside each company (pick or type a new one in the sheet) */
export const DEPARTMENTS = {
  'al-noor': ['Transport', 'Transport (Abu Dhabi)', 'Construction', 'IT', 'Admin / Office'],
  sahil: ['Admin / Office', 'Construction', 'IT', 'Marketing']
};

/* Lines copied automatically from Transport or a payment receipt: change them at the source */
export const SOURCE_LABEL = {
  transport_entries: 'Transport trip sheet', transport_salaries: 'Transport salaries', transport_extras: 'Transport other expenses',
  vehicle_maintenance: 'Vehicle maintenance', company_docs: 'Bill'
};

export const PAY_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'PDC', 'Card'];

export const n = (v) => Number(v || 0);
export const r3 = (v) => Math.round(n(v) * 1000) / 1000;

/* Salary sheet (from the Excel): gross = (basic + allowances) / 30 x working days, net = gross - deductions */
export function staffGross(s) { return r3(((n(s.basic) + n(s.allowances)) / 30) * n(s.working_days)); }
export function staffNet(s) { return r3(staffGross(s) - n(s.deductions)); }
