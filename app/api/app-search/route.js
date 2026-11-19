import { createClient } from '@supabase/supabase-js';
import { appWatchData, appWatchContext } from '@/lib/appWatch';
import { inventoryData, inventoryContext, transportData, transportContext, askAI } from '@/lib/assistant';
import { accessOf, filterWatch, filterInventory, emptyTransport } from '@/lib/aiAccess';
import { COMPANIES } from '@/lib/expenses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  AI Search on the Home page: searches the WHOLE app (documents checklist, transport, office expense of the 3 companies,
  inventory, bills, invoices, alerts) as the logged-in user and answers with a short reply plus links to the right pages.
  Body: { query }. Returns { answer, links: [{ label, href }] }.
*/
const SEC = { employee: 'Employee Docs', car: 'Cars Docs', heavy: 'Heavy Vehicles', govt: 'Govt License', company: 'Company Docs' };
const dmy = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '-');
const muscatToday = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Please log in again.' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Bad request.' }, { status: 400 }); }
  const query = String(body.query || '').trim().slice(0, 400);
  if (!query) return Response.json({ error: 'Type what you are looking for.' }, { status: 400 });

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: u, error: uErr } = await supa.auth.getUser(token);
  if (uErr || !u?.user) return Response.json({ error: 'Please log in again.' }, { status: 401 });

  const q = (p) => p.then((r) => r.data || []).catch(() => []);
  const today = muscatToday();
  // 🔒 only what this user may open (lib/aiAccess.js, Owner 11 Nov 2026)
  const A = await accessOf(supa, u.user);
  const [watch, tr, inv, docsAll, driversAll, catsAll] = await Promise.all([
    appWatchData(supa).then((d) => appWatchContext(filterWatch(d, A))).catch(() => ''),
    A.transport ? transportData(supa).then(transportContext).catch(() => '') : Promise.resolve(transportContext(emptyTransport)),
    inventoryData(supa).then((d) => inventoryContext(filterInventory(d, A))).catch(() => ''),
    q(supa.from('doc_checklist').select('section, owner, doc_name, doc_no, issue_date, expiry_date, state').order('sort')),
    q(supa.from('transport_drivers').select('id, name').is('archived_at', null).order('sort')),
    q(supa.from('categories').select('id, name, company').order('sort'))
  ]);
  const docs = A.canAny('docs') ? docsAll : [];
  const drivers = A.transport ? driversAll : [];
  const cats = catsAll.filter((c) => !c.company || A.can(c.company, 'inventory'));

  const docLines = docs.map((r) => {
    const left = r.expiry_date ? Math.round((new Date(`${r.expiry_date}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000) : null;
    const st = r.state || (left === null ? 'no expiry date' : left < 0 ? `EXPIRED ${-left} days ago` : `${left} days left`);
    return `- ${SEC[r.section]} | ${r.owner || '-'} | ${r.doc_name || '-'}${r.doc_no ? ` No ${r.doc_no}` : ''} | issued ${dmy(r.issue_date)} | expires ${dmy(r.expiry_date)} | ${st}`;
  });

  const pages = [
    ['Home (alerts)', '/'], ['Sitemap (every page and where it is)', '/sitemap'], ['Timeline (what was built on which day)', '/timeline'],
    ...(A.canAny('docs') ? [['Documents Checklist: Company Docs', '/docs?tab=company'], ['Documents Checklist: Govt License', '/docs?tab=govt'],
      ['Documents Checklist: Cars Docs', '/docs?tab=car'], ['Documents Checklist: Heavy Vehicles', '/docs?tab=heavy'], ['Documents Checklist: Employee Docs', '/docs?tab=employee']] : []),
    ...(A.transport ? [['Transport Expense (monthly summary per driver)', '/transport'], ['Transport Reports', '/transport/reports'],
      ['Drivers (resident card, visa, salary receipts)', '/transport/drivers'], ['All drivers salary sheet (one month)', '/transport/salary-sheet'], ['Vehicles (VOC, Mulkiya) and Maintenance', '/transport/vehicles'], ['Transport Invoice', '/transport/invoice']] : []),
    ...drivers.map((d) => [`Trip sheet of ${d.name}`, `/transport/${d.id}`]),
    ...drivers.map((d) => [`Salary slip of ${d.name}`, `/transport/salary/${d.id}`]),
    ...drivers.map((d) => [`Salary sheet of ${d.name} (salary detail every month + his other expenses)`, `/transport/salary-sheet/${d.id}`]),
    ...COMPANIES.filter((c) => A.can(c.key, 'expenses')).map((c) => [`All Companies: ${c.short} expense sheet`, `/expenses?co=${c.key}`]),
    ...COMPANIES.filter((c) => A.can(c.key, 'bills')).map((c) => [`${c.short}: Bills`, `/expenses/docs?co=${c.key}&kind=receipt`]),
    ...COMPANIES.filter((c) => A.can(c.key, 'invoices')).map((c) => [`${c.short}: Invoices`, `/expenses/docs?co=${c.key}&kind=invoice`]),
    ...COMPANIES.filter((c) => A.can(c.key, 'summary')).map((c) => [`${c.short}: Reports & Summary (budgets, cash flow, unpaid bills)`, `/expenses/summary?co=${c.key}`]),
    ...(A.all ? [['Reports & Summary of all companies', '/expenses/summary']] : []),
    ['Inventory', '/inventory'], ['Inventory Reports', '/inventory/reports'], ['Utility Bills', '/bills'], ['Stock log', '/log'],
    ...COMPANIES.filter((c) => A.can(c.key, 'inventory')).map((c) => [`${c.short}: own Inventory`, `/inventory?co=${c.key}`]),
    ...cats.map((c) => [`Inventory section: ${c.name}${c.company ? ` (${COMPANIES.find((x) => x.key === c.company)?.short || c.company})` : ''}`, `/c/${c.id}`])
  ];

  const system = `You are the search box of "Daftar Office System" (Al Noor Logistics and Trading, Sahil, Transport Division, Muscat, Oman). Today is ${dmy(today)} (dd/mm/yyyy). Money is OMR with 3 decimals.
The user types a search or question in English, Roman Urdu or Urdu, maybe with spelling mistakes or short forms (MC = Al Noor, AW = CR = CR Paper, mulkiya = vehicle registration).
Answer ONLY from the data below. Never invent numbers. If the data does not have it, say so (this user may not have access to it).
This user sees ONLY the companies and pages given to him; never mention other companies' data.
Return ONLY JSON, nothing else:
{"answer":"short helpful answer in plain English, at most 5 short lines, use \\n between lines, no markdown, no stars","links":[{"label":"page name","href":"one href from PAGES"}]}
Give 1 to 4 links, most useful first, ONLY hrefs from PAGES.

PAGES:
${pages.map(([l, h]) => `${h} = ${l}`).join('\n')}

=== DOCUMENTS CHECKLIST (${docLines.length}) ===
${docLines.join('\n').slice(0, 5000)}

${String(watch).slice(0, 7000)}

=== TRANSPORT DETAIL ===
${String(tr).slice(0, 4000)}

=== INVENTORY DETAIL ===
${String(inv).slice(0, 2500)}`;

  const valid = new Set(pages.map(([, h]) => h));
  try {
    const raw = await askAI(system, [{ role: 'user', content: query }]);
    const m = String(raw || '').match(/\{[\s\S]*\}/);
    let parsed = null;
    try { parsed = JSON.parse(m ? m[0] : ''); } catch { parsed = null; }
    if (!parsed) return Response.json({ answer: String(raw || 'No answer.').replace(/[*#`]/g, '').slice(0, 800), links: [] });
    const links = (Array.isArray(parsed.links) ? parsed.links : [])
      .filter((l) => l && valid.has(l.href)).slice(0, 4)
      .map((l) => ({ href: l.href, label: String(l.label || pages.find(([, h]) => h === l.href)?.[0] || 'Open').slice(0, 60) }));
    return Response.json({ answer: String(parsed.answer || '').replace(/[*#`]/g, '').slice(0, 800), links });
  } catch (e) {
    // Technical reasons go to the Vercel logs only, never to the user
    console.error('ai search error', e.code || '', String(e.message || '').slice(0, 500));
    return Response.json({ error: 'AI Search is busy right now. Please try again in a little while.', code: 'busy' }, { status: 503 });
  }
}
