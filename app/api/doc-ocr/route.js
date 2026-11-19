import { createClient } from '@supabase/supabase-js';
import { todayLine } from '@/lib/today';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/*
  📥 Import documents (All Companies > Invoices / Payment receipts, app/expenses/docs/page.js).
  Body: { image: 'data:image/jpeg;base64,...', kind: 'invoice'|'receipt', company }.
  The page shrinks each photo / PDF page to a JPEG first. A vision AI reads the paper and returns JSON:
  the main fields for the receipt form + EVERY other label printed on the paper (TXN ID, Ticket, TID,
  Date of supply, Date of payment, Time, User, Pump No., VEH No. = vehicle number, product, quantity, price ...).
  Order of AI services (each only if its key is set in Vercel): Groq qwen/qwen3.8-27b (Llama 4 vision models were removed from Groq) -> OpenRouter -> Mistral -> OpenAI -> Anthropic.
  Nothing is saved here: the page shows the result to check and edit before Save.
*/

const PROMPT = `You read photos of BILLS from Oman (English and Arabic). Every paper you get is a bill that the company paid (an expense),
even when the paper itself says "Tax Invoice", "Invoice", "Cash Memo" or "Receipt". Copy ONLY what is printed on this paper. Never guess, never fill in from other knowledge.
Currency is Omani Rial (OMR, RO, R.O., ر.ع) with 3 decimals (1 OMR = 1000 baisa). Dates in Oman are day/month/year.
Glossary:
- MOGAS 98, MOGAS 95, MOGAS 91, M98, M95, M91, Super, Regular = PETROL. Gasoil, Diesel = DIESEL.
- VEH, VEH No, Vehicle No, Plate = vehicle number (Oman plates look like 1234 AB).
- TXN, TXN ID, Trans No = transaction id. TID = terminal id. MID = merchant id. Ticket / Ticket No = ticket number.
- Pump, Pump No, Nozzle = pump number. User / Cashier / Attendant = the person at the counter.
- Qty in L or Ltr = litres. Unit price = price per litre.
- "Inclusive" / "incl. VAT" means the amounts already contain VAT 5%. "Exclusive" means VAT is added on top.
Return ONLY one JSON object, no other text, in this exact shape:
{
 "doc_type": "fuel receipt | invoice | tax invoice | payment receipt | bill | other",
 "vendor": "shop or company that issued the paper",
 "vendor_details": "branch, address, phone (short)",
 "vendor_vat": "VAT / VATIN number of the issuer or empty",
 "doc_no": "invoice or receipt or bill number (empty if none)",
 "date": "the bill date PRINTED on this paper, as YYYY-MM-DD (label Date, Bill Date, Invoice Date, Tax Invoice Date, Date of supply or Date of payment). NOT a Ref / LPO / PO / Quotation / Delivery note / Due date. Empty if no bill date is printed",
 "date_sure": true or false (false if any digit of the bill date is unclear, or the English and Arabic dates do not agree),
 "date_options": ["YYYY-MM-DD", ...] every possible reading of the bill date when date_sure is false (2 or 3 at most), else [],
 "date_seen": "the bill date exactly as printed, digits and Arabic words as they appear",
 "time": "HH:MM or empty",
 "payment_method": "Cash, Card, Bank Transfer, Cheque or PDC only if printed on the paper, else an empty string",
 "vehicle_no": "vehicle number if printed, else empty",
 "items": [{"desc": "plain English, e.g. Petrol (MOGAS 95)", "qty": number or null, "unit": "L or pcs or empty", "unit_price": number or null, "amount": number}],
 "vat_mode": "inclusive | exclusive | none",
 "vat_pct": 5 or 0,
 "subtotal_excl_vat": the Subtotal / Net amount PRINTED on the paper, or null if no subtotal is printed (do NOT work it out),
 "vat_amount": the VAT amount PRINTED on the paper, 0 if the paper shows no VAT, or null if not readable (do NOT work it out),
 "total": the Grand Total / Total PRINTED on the paper (do NOT work it out),
 "cash_given": number or null,
 "change": number or null,
 "fields": [{"label": "label exactly as printed", "value": "value as printed"}],
 "is_fuel": true or false,
 "confidence": "high | medium | low",
 "warnings": "short note only if something on the paper is unclear or blurred, or the amounts do not add up, else an empty string. Do NOT compare dates with each other and do NOT write notes about Ref, LPO or other dates",
 "printed_by": "till or POS printout | computer printed | handwritten | screenshot | other",
 "looks_edited": true or false,
 "edit_signs": "if looks_edited: short note of what looks changed (different font or size in one spot, patched or blurred area, numbers not aligned), else empty"
}
Look carefully for signs the paper was edited or made up: one number in a different font, size or colour, patched or smudged areas, misaligned digits, totals that do not add up. Only set looks_edited true when you really see such signs.
Rules: "fields" must list EVERY label and value printed on the paper (TXN ID, Ticket, TID, MID, Date of supply, Date of payment, Time, User, Pump No, VEH No, Product, Quantity, Price, Amount, Cash, VAT, Total, card last 4 digits, approval code, etc.), even if also used above.
Numbers are plain numbers (5.000 -> 5, 0.239 -> 0.239), never text. Copy every amount exactly as printed: never calculate, round or correct any amount, even if the paper's sums look wrong (Owner rule: paste as it is). Do not invent values: if you cannot read something, leave it empty and say so in warnings.
Empty means an empty string "", never the word "empty", "none" or "N/A".
DATES (Owner rule): Oman bills often print the date in English AND in Arabic, with Arabic words and Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩ = 0123456789,
and month names يناير/كانون الثاني=1, فبراير/شباط=2, مارس/آذار=3, أبريل/نيسان=4, مايو/أيار=5, يونيو/حزيران=6, يوليو/تموز=7, أغسطس/آب=8, سبتمبر/أيلول=9, أكتوبر/تشرين الأول=10, نوفمبر/تشرين الثاني=11, ديسمبر/كانون الأول=12; التاريخ = Date).
Read BOTH the English and the Arabic date and use them to check each other. Arabic text and digits mixed into the date can make one digit look like another: decide from the Arabic words what the digit or month really is.
Day comes before month (dd/mm/yyyy), never month first. If you are not fully sure, set date_sure false and list the possible dates in date_options. Do not pick one yourself.
If the paper is not a bill, invoice or receipt, return {"doc_type":"other","warnings":"not a bill or receipt"}.`;

async function openaiStyle(url, key, models, image, errs) {
  for (const model of [...new Set(models.filter(Boolean))]) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model, temperature: 0, max_tokens: 6000,
          messages: [{ role: 'user', content: [{ type: 'text', text: todayLine() + PROMPT }, { type: 'image_url', image_url: { url: image } }] }]
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = data.choices?.[0]?.message?.content;
        const t = Array.isArray(text) ? text.map((x) => x.text || '').join('') : String(text || '');
        if (t.trim()) return { text: t, model };
        errs.push(`${model}: empty answer`);
        continue;
      }
      errs.push(`${model}: ${res.status} ${data?.error?.message || ''}`.trim());
      if (res.status === 401) break;
    } catch (e) {
      errs.push(`${model}: ${e.message}`);
    }
  }
  return null;
}

async function readImage(image) {
  const errs = [];
  const env = process.env;
  if (env.GROQ_API_KEY) {
    const a = await openaiStyle('https://api.groq.com/openai/v1/chat/completions', env.GROQ_API_KEY,
      [env.OCR_MODEL, 'qwen/qwen3.8-27b'], image, errs);
    if (a) return a;
  }
  if (env.OPENROUTER_API_KEY) {
    const a = await openaiStyle('https://openrouter.ai/api/v1/chat/completions', env.OPENROUTER_API_KEY,
      [env.OPENROUTER_OCR_MODEL, 'qwen/qwen2.5-vl-72b-instruct:free', 'google/gemma-3-27b-it:free', 'meta-llama/llama-4-maverick:free', 'openrouter/free'], image, errs);
    if (a) return a;
  }
  if (env.MISTRAL_API_KEY) {
    const a = await openaiStyle('https://api.mistral.ai/v1/chat/completions', env.MISTRAL_API_KEY,
      ['pixtral-large-latest', 'mistral-small-latest', 'pixtral-12b-2409'], image, errs);
    if (a) return a;
  }
  if (env.OPENAI_API_KEY) {
    const a = await openaiStyle('https://api.openai.com/v1/chat/completions', env.OPENAI_API_KEY, ['gpt-4o-mini'], image, errs);
    if (a) return a;
  }
  if (env.ANTHROPIC_API_KEY) {
    const m = String(image).match(/^data:(image\/\w+);base64,(.+)$/);
    if (m) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5', max_tokens: 2000, temperature: 0,
            messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }, { type: 'text', text: todayLine() + PROMPT }] }]
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) return { text: (data.content || []).map((c) => c.text || '').join(''), model: 'claude-haiku-4-5' };
        errs.push(`claude: ${res.status} ${data?.error?.message || ''}`);
      } catch (e) { errs.push(`claude: ${e.message}`); }
    }
  }
  const e = new Error(errs.length ? errs.join(' | ') : 'No AI key is set in Vercel.');
  e.code = errs.length ? 'AI_FAIL' : 'NO_KEY';
  throw e;
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(x) ? x : null;
};
const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

function isoDate(v) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); // day/month/year (Oman)
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return '';
}

// the word "empty", "none", "N/A" from the AI means nothing was printed
const blank = (v) => {
  const t = String(v ?? '').trim();
  return /^(empty|none|null|n\/?a|nil|-+|not (printed|given|shown|found))$/i.test(t) ? '' : t;
};

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
// every date written inside a piece of text, as YYYY-MM-DD (day/month/year, year-month-day, 19 Dec 2025, Dec 19, 2025)
const toLatinDigits = (t) => String(t || '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
function datesIn(text) {
  const s = toLatinDigits(text);
  const out = new Set();
  const add = (y, m, d) => {
    y = String(y).length === 2 ? `20${y}` : String(y);
    m = Number(m); d = Number(d);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) out.add(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  };
  for (const m of s.matchAll(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/g)) add(m[1], m[2], m[3]);
  for (const m of s.matchAll(/(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g)) add(m[3], m[2], m[1]);
  for (const m of s.matchAll(/(\d{1,2})[\s.-]*([A-Za-z]{3})[A-Za-z]*[\s.,-]*(\d{4}|\d{2})(?!\d)/g)) { const mo = MONTHS[m[2].toLowerCase()]; if (mo) add(m[3], mo, m[1]); }
  for (const m of s.matchAll(/([A-Za-z]{3})[A-Za-z]*[\s.-]*(\d{1,2}),?[\s.-]*(\d{4})/g)) { const mo = MONTHS[m[1].toLowerCase()]; if (mo) add(m[3], mo, m[2]); }
  return out;
}

// Owner 9 Nov 2026: the date must be the one printed on the bill. If the AI's date is not written anywhere
// in what it read from the paper, it is not on the bill: leave the Date box empty and say so.
function checkDate(date, fields, warnings) {
  if (!date) return { date: '', note: 'No bill date found on the paper. Please type the date from the bill.' };
  if (!fields.length) return { date, note: '' };
  const seen = new Set();
  for (const f of fields) for (const d of datesIn(`${f.label} ${f.value}`)) seen.add(d);
  if (seen.has(date)) return { date, note: '' };
  // the AI sometimes swaps day and month: accept it if the swapped date is printed
  const [y, m, d] = date.split('-');
  const swapped = `${y}-${d}-${m}`;
  if (Number(d) <= 12 && seen.has(swapped)) return { date: swapped, note: '' };
  return { date: '', note: 'The date the AI gave is not printed on this bill, so the Date box is left empty. Please type the date from the bill.' };
}

function clean(p) {
  const items = (Array.isArray(p.items) ? p.items : []).map((i) => ({
    desc: String(i.desc || '').trim(), qty: num(i.qty), unit: String(i.unit || '').trim(), unit_price: num(i.unit_price), amount: num(i.amount)
  })).filter((i) => i.desc || i.amount !== null);
  // Owner 11 Nov 2026: amounts exactly as printed, nothing worked out (a figure not printed stays empty)
  const total = num(p.total);
  const vat = num(p.vat_amount);
  const sub = num(p.subtotal_excl_vat);
  const mode = ['inclusive', 'exclusive', 'none'].includes(p.vat_mode) ? p.vat_mode : (vat ? 'inclusive' : 'none');
  const fields = (Array.isArray(p.fields) ? p.fields : []).map((f) => ({ label: blank(f.label), value: blank(f.value) })).filter((f) => f.label || f.value).slice(0, 60);
  // drop AI notes that compare dates (Ref / LPO date "in the future" etc.): only the bill date matters
  const aiWarn = blank(p.warnings).split(/(?<=\.)\s+/).filter((w) => w && !/\b(ref|lpo|po|quotation|delivery|due)\b.*date|date.*\b(future|relative|before|after)\b/i.test(w)).join(' ');
  let dc = checkDate(isoDate(toLatinDigits(blank(p.date))), fields, aiWarn);
  // Owner 9 Nov 2026: when the date is not clear, ASK (leave the box empty and show the choices)
  const dateOptions = [...new Set((Array.isArray(p.date_options) ? p.date_options : []).map((d) => isoDate(toLatinDigits(blank(d)))).filter(Boolean))].slice(0, 3);
  const unsure = p.date_sure === false || p.date_sure === 'false';
  if (unsure) {
    if (dc.date && !dateOptions.includes(dc.date)) dateOptions.unshift(dc.date);
    dc = { date: '', note: `The date on the bill is not clear${blank(p.date_seen) ? ` (printed: ${blank(p.date_seen)})` : ''}. Please pick the right date or type it.` };
  }
  return {
    doc_type: blank(p.doc_type) || 'bill',
    vendor: blank(p.vendor),
    vendor_details: blank(p.vendor_details),
    vendor_vat: blank(p.vendor_vat),
    doc_no: blank(p.doc_no),
    date: dc.date,
    date_options: dc.date ? [] : dateOptions,
    date_seen: blank(p.date_seen),
    time: blank(p.time),
    payment_method: blank(p.payment_method),
    vehicle_no: blank(p.vehicle_no),
    items,
    vat_mode: mode,
    vat_pct: vat && vat > 0 ? 5 : 0,
    subtotal_excl_vat: sub,
    vat_amount: vat,
    total,
    cash_given: num(p.cash_given),
    change: num(p.change),
    fields,
    is_fuel: !!p.is_fuel || items.some((i) => /petrol|diesel|mogas|gasoil/i.test(i.desc)),
    confidence: String(p.confidence || ''),
    warnings: [dc.note, aiWarn].filter(Boolean).join(' '),
    printed_by: String(p.printed_by || '').trim(),
    looks_edited: p.looks_edited === true || p.looks_edited === 'true',
    edit_signs: String(p.edit_signs || '').trim()
  };
}

export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Please log in again.' }, { status: 401 });
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: u, error: uErr } = await supa.auth.getUser(token);
  if (uErr || !u?.user) return Response.json({ error: 'Please log in again.' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'The file is too big to read. Send a smaller photo.' }, { status: 400 }); }
  const image = String(body.image || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) return Response.json({ error: 'Only photos and PDFs can be read.' }, { status: 400 });

  try {
    const { text, model } = await readImage(image);
    const m = String(text).replace(/<think>[\s\S]*?<\/think>/gi, '').match(/\{[\s\S]*\}/);
    let parsed;
    try { parsed = JSON.parse(m ? m[0] : '{}'); } catch { return Response.json({ error: 'The AI answer could not be read. Try again or use a clearer photo.' }, { status: 502 }); }
    return Response.json({ data: clean(parsed), model });
  } catch (e) {
    const msg = e.code === 'NO_KEY' ? 'No AI key with photo reading is set in Vercel.'
      : /rate|limit|quota|429/i.test(e.message) ? 'The free AI limit is used up for now. Try again later.'
        : `The AI could not read this file. ${e.message.slice(0, 900)}`;
    return Response.json({ error: msg }, { status: 502 });
  }
}
