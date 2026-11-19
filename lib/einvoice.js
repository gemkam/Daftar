/*
  🧾 Govt e-invoice (Oman Fawtara) for Al Noor company invoices (Owner, 9 Nov 2026).
  The app makes an "e-invoice ready" invoice: all main Fawtara fields, English + Arabic, QR code (TLV, Base64),
  invoice UUID, issue date and time, and a UBL XML file (PINT-OM style) to hand to the accredited service provider.
  The app does NOT send anything to the Oman Tax Authority: under Fawtara that is done only by an accredited
  service provider over Peppol (Al Noor's phase: 1 Oct 2027, or 1 Apr 2027 if sales are above OMR 5 million).
  QR: GCC style TLV tags 1 seller name, 2 seller VAT No., 3 date-time (ISO), 4 total with VAT, 5 VAT total,
  6 invoice UUID. The OTA Seller UUID (BTOM-004) formula is not public yet, so tag 6 carries the invoice UUID until
  the service provider confirms. Seller Arabic name: CHECK with Owner.
*/

import { sb } from '@/lib/supabase';
import { COMPANIES } from '@/lib/expenses';

/* 9 Nov 2026 (Owner): every company (and every company added later) gets the same e-invoice.
   Seller details = company (name, CR, address, logo) + VAT No. and Arabic name typed in
   Admin › Company access › 🧾 E-invoice details (app_settings key "einv.sellers" = JSON {companyKey: {vat, name_ar}}).
   On Save a copy of the seller details is kept in the invoice (einv.seller), so old invoices never change. */
const DEFAULTS = {
  'al-noor': { vat: 'OM1100000001', name_ar: 'النور للخدمات اللوجستية والتجارة ش.م.م' },
  sahil: { vat: 'OM1100000002', name_ar: 'الساحل للخدمات الفنية ش.م.م' }
};
export const SETTINGS_KEY = 'einv.sellers';
let extra = {};
let loaded = null;
export function loadSellers(force = false) {
  if (!loaded || force) {
    loaded = sb().from('app_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle()
      .then(({ data }) => { try { extra = data?.value ? JSON.parse(data.value) : {}; } catch { extra = {}; } return extra; })
      .catch(() => extra);
  }
  return loaded;
}
// 🙋 companies added on ＋ Add company carry their own VAT No. and Arabic name (personnel_companies)
const ownSeller = (co) => { const c = COMPANIES.find((x) => x.key === co); return c && (c.vat || c.nameAr) ? { ...(c.vat ? { vat: c.vat } : {}), ...(c.nameAr ? { name_ar: c.nameAr } : {}) } : {}; };
export const sellerExtra = (co) => ({ ...(DEFAULTS[co] || {}), ...ownSeller(co), ...(extra[co] || {}) });
export async function saveSellerExtra(co, vals) {
  await loadSellers(true);
  const next = { ...extra, [co]: { ...(extra[co] || {}), ...vals } };
  const { error } = await sb().from('app_settings').upsert({ key: SETTINGS_KEY, value: JSON.stringify(next), updated_at: new Date().toISOString() });
  if (error) throw error;
  extra = next;
}
const parseAddr = (a) => {
  const box = String(a || '').match(/P\.?\s*O\.?\s*Box\s*\d+/i)?.[0] || '';
  const pc = String(a || '').match(/PC\s*(\d+)/i)?.[1] || '';
  return { street: box || String(a || ''), postal: pc, city: /Khuwair/i.test(a || '') ? 'Al Khuwair, Muscat' : 'Muscat' };
};
export function sellerOf(co) {
  const c = COMPANIES.find((x) => x.key === co) || {};
  const e = sellerExtra(co);
  return {
    key: co, short: c.short || '', name_en: c.name || c.short || '', name_ar: e.name_ar || '', vat: e.vat || '',
    cr: String(c.cr || '').replace(/^CR:?\s*/i, ''), address: c.address || '', logo: c.logo || '', country: 'OM', ...parseAddr(c.address)
  };
}
/* the seller printed on an invoice: the copy saved with it, else today's details */
export const sellerFor = (co, doc) => (doc?.einv?.seller ? { ...sellerOf(co), ...doc.einv.seller } : sellerOf(co));

/* Govt QR hidden for now (Owner 9 Nov 2026); our "Scan to view this invoice" QR is shown instead */
export const SHOW_GOVT_QR = false;
/* link opened by our QR: full invoice + ⬇ Download PDF, no login (app/i/[uuid]) */
export const viewUrl = (uuid) => `${typeof window !== 'undefined' ? window.location.origin : ''}/i/${uuid || ''}`;
export const isEinvoice = (co, kind) => kind === 'invoice' && !!co;

const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const f3 = (v) => r3(v).toFixed(3);

export function newUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* totals the same way as the invoice paper.
   Discount (Ali Pack Excel, 11 Nov 2026): Net Total = Subtotal + Discount (type a minus figure to take money off),
   VAT = Net Total x VAT %, Grand Total = VAT + Net Total. With no discount it is the same as before. */
export function totalsOf(doc) {
  const items = r3((doc.items || []).reduce((t, i) => t + (Number(i.amount) || 0), 0));
  const disc = r3(doc.discount);
  const sub = r3(items + disc);
  const vat = r3((sub * (Number(doc.vat_pct) || 0)) / 100);
  return { items, disc, sub, vat, tot: r3(sub + vat) };
}

/* date-time of issue in Muscat as ISO with +04:00 */
export function issueISO(doc) {
  const at = doc.einv?.issued_at ? new Date(doc.einv.issued_at) : new Date();
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Muscat', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(at).reduce((o, x) => ({ ...o, [x.type]: x.value }), {});
  const date = doc.doc_date || `${p.year}-${p.month}-${p.day}`;
  const time = `${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}`;
  return { date, time, iso: `${date}T${time}+04:00` };
}

export function buyerType(doc) { return String(doc.party_vat || '').trim() ? 'B2B' : 'B2C'; }

/* QR text: TLV bytes -> Base64 */
export function qrText(co, doc) {
  const s = sellerFor(co, doc);
  const { vat, tot } = totalsOf(doc);
  const fields = [s.name_en, s.vat, issueISO(doc).iso, f3(tot), f3(vat), doc.einv?.uuid || ''];
  const enc = new TextEncoder();
  const bytes = [];
  fields.forEach((v, i) => {
    const b = enc.encode(String(v));
    bytes.push(i + 1, Math.min(b.length, 255), ...b.slice(0, 255));
  });
  let bin = '';
  bytes.forEach((x) => { bin += String.fromCharCode(x); });
  return btoa(bin);
}

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* UBL 2.1 invoice in PINT-OM style, for the accredited service provider */
export function ublXml(co, doc) {
  const s = sellerFor(co, doc);
  const { items: lineSum, disc, sub, vat, tot } = totalsOf(doc);
  const { date, time } = issueISO(doc);
  const pct = Number(doc.vat_pct) || 0;
  const cat = pct > 0 ? 'S' : 'Z';
  const buyerVat = String(doc.party_vat || '').trim();
  const lines = (doc.items || []).filter((i) => String(i.desc || '').trim() || Number(i.amount)).map((it, k) => {
    const qty = Number(it.qty) || 1;
    const amt = r3(it.amount);
    const price = it.price !== undefined && it.price !== '' ? r3(it.price) : r3(amt / qty);
    return `  <cac:InvoiceLine>
    <cbc:ID>${k + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${qty}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="OMR">${f3(amt)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(it.desc || 'Service')}</cbc:Name>
      <cac:ClassifiedTaxCategory><cbc:ID>${cat}</cbc:ID><cbc:Percent>${pct}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="OMR">${f3(price)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Fawtara e-invoice ready (PINT-OM style), made by Daftar Office System. To be validated and signed by the accredited service provider. -->
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:peppol:pint:billing-1@om-1</cbc:CustomizationID>
  <cbc:ProfileID>urn:peppol:bis:billing</cbc:ProfileID>
  <cbc:ID>${esc(doc.doc_no)}</cbc:ID>
  <cbc:UUID>${esc(doc.einv?.uuid || '')}</cbc:UUID>
  <cbc:IssueDate>${date}</cbc:IssueDate>
  <cbc:IssueTime>${time}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>388</cbc:InvoiceTypeCode>
  ${doc.notes ? `<cbc:Note>${esc(doc.notes)}</cbc:Note>` : ''}
  <cbc:DocumentCurrencyCode>OMR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>OMR</cbc:TaxCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0248">${esc(s.vat)}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${esc(s.name_en)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cbc:StreetName>${esc(s.street)}</cbc:StreetName><cbc:CityName>${esc(s.city)}</cbc:CityName><cbc:PostalZone>${esc(s.postal)}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>${s.country}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
      <cac:PartyTaxScheme><cbc:CompanyID>${esc(s.vat)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${esc(s.name_en)}</cbc:RegistrationName><cbc:CompanyID>${esc(s.cr)}</cbc:CompanyID></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${buyerVat ? `<cbc:EndpointID schemeID="0248">${esc(buyerVat)}</cbc:EndpointID>` : ''}
      <cac:PartyName><cbc:Name>${esc(doc.party)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>${doc.party_details ? `<cbc:StreetName>${esc(doc.party_details)}</cbc:StreetName>` : ''}<cac:Country><cbc:IdentificationCode>OM</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
      ${buyerVat ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(buyerVat)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity><cbc:RegistrationName>${esc(doc.party)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  ${disc ? `<cac:AllowanceCharge><cbc:ChargeIndicator>${disc > 0 ? 'true' : 'false'}</cbc:ChargeIndicator><cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason><cbc:Amount currencyID="OMR">${f3(Math.abs(disc))}</cbc:Amount><cac:TaxCategory><cbc:ID>${cat}</cbc:ID><cbc:Percent>${pct}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:AllowanceCharge>` : ''}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="OMR">${f3(vat)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="OMR">${f3(sub)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="OMR">${f3(vat)}</cbc:TaxAmount>
      <cac:TaxCategory><cbc:ID>${cat}</cbc:ID><cbc:Percent>${pct}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="OMR">${f3(lineSum)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="OMR">${f3(sub)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="OMR">${f3(tot)}</cbc:TaxInclusiveAmount>
    ${disc < 0 ? `<cbc:AllowanceTotalAmount currencyID="OMR">${f3(-disc)}</cbc:AllowanceTotalAmount>` : ''}${disc > 0 ? `<cbc:ChargeTotalAmount currencyID="OMR">${f3(disc)}</cbc:ChargeTotalAmount>` : ''}
    <cbc:PayableAmount currencyID="OMR">${f3(tot)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines}
</Invoice>
`;
}

export function downloadText(name, text, type = 'application/xml') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* the invoice paper as an A4 PDF file (for WhatsApp / email / download) */
export async function paperPdf(el, name) {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');
  document.body.classList.add('einv-snap');
  try {
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: true });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const w = 210; const h = 297; const m = 8;
    const iw = w - m * 2;
    const ih = (canvas.height * iw) / canvas.width;
    const fit = ih > h - m * 2 ? (h - m * 2) / ih : 1;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', m + (iw - iw * fit) / 2, m, iw * fit, ih * fit);
    const blob = pdf.output('blob');
    return new File([blob], name, { type: 'application/pdf' });
  } finally {
    document.body.classList.remove('einv-snap');
  }
}
