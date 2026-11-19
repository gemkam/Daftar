'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { sb } from '@/lib/supabase';
import { COMPANIES } from '@/lib/expenses';
import { omrInWords } from '@/lib/words';
import { fmtFullDate } from '@/lib/sheet';
import { sellerFor, totalsOf, issueISO, buyerType, paperPdf } from '@/lib/einvoice';
import SignStamp from '@/components/SignStamp';
import AliPackPaper from '@/components/AliPackPaper';

/*
  🧾 Client's invoice page, no login: /i/<invoice UUID> (Owner, 9 Nov 2026).
  Opened by the "Scan to view this invoice" QR on every company's invoices (and the link in WhatsApp / email).
  Shows the full invoice and ⬇ Download PDF. Data from RPC public_invoice(uuid) (only invoices with an e-invoice UUID).
*/
const f3 = (v) => (Math.round((Number(v) || 0) * 1000) / 1000).toFixed(3);

export default function ClientInvoice() {
  const { uuid } = useParams();
  const [doc, setDoc] = useState(undefined); // undefined loading, null not found
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    sb().rpc('public_invoice', { p_uuid: String(uuid || '') }).then(({ data, error }) => setDoc(error ? null : data || null));
  }, [uuid]);

  async function download() {
    setBusy(true);
    try {
      const f = await paperPdf(ref.current, `${doc.doc_no || 'invoice'}.pdf`);
      const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    } catch { /* ignore */ }
    setBusy(false);
  }

  if (doc === undefined) return <main className="ci-page"><p className="muted">Loading invoice...</p></main>;
  if (!doc) return <main className="ci-page"><p className="empty">This invoice link is not valid.</p></main>;

  const S = sellerFor(doc.company, doc);
  const C0 = COMPANIES.find((c) => c.key === doc.company) || {};
  const C = { short: S.short || C0.short, name: S.name_en || C0.name, cr: S.cr ? `CR: ${S.cr}` : C0.cr, address: S.address || C0.address, logo: S.logo || C0.logo };
  const { items: lines, disc, sub, vat, tot } = totalsOf(doc);
  const when = issueISO(doc);
  const items = (doc.items || []).filter((i) => String(i.desc || '').trim() || Number(i.amount));

  return (
    <main className="ci-page">
      <div className="ci-bar no-print">
        <button type="button" className="btn" onClick={download} disabled={busy}>{busy ? 'Making PDF...' : '⬇ Download PDF'}</button>
        <button type="button" className="btn ghost" onClick={() => window.print()}>🖨 Print</button>
      </div>
      {doc.company === 'ali-pack' ? <AliPackPaper doc={doc} S={S} C={C} ro client when={when} paperRef={ref} /> : (
      <article ref={ref} className="cd-paper k-invoice ro einv ci-paper">
        <header className="cd-head">
          {C.logo && <img className="cd-logo" src={C.logo} alt={C.short} />}
          <div className="cd-co">
            <b>{C.name}</b>
            {S.name_ar && <b className="ei-ar" dir="rtl" lang="ar">{S.name_ar}</b>}
            <span>{C.cr}{S.vat ? ` · VAT No. ${S.vat}` : ''}</span>
            <span>{C.address}</span>
          </div>
          <div className="cd-title">
            <div className="cd-title-main">TAX INVOICE <span className="ei-ar" dir="rtl" lang="ar">فاتورة ضريبية</span></div>
            <div className="cd-meta">
              <label><span>No. / الرقم</span><span className="cd-ro">{doc.doc_no}</span></label>
              <label><span>Date / التاريخ</span><span className="cd-ro">{doc.doc_date ? fmtFullDate(doc.doc_date) : ''}</span></label>
              <label><span>Time / الوقت</span><span className="cd-ro">{when.time}</span></label>
            </div>
          </div>
        </header>
        <div className="cd-rule" />
        <div className="ei-strip">
          <span><b>{buyerType(doc) === 'B2B' ? 'B2B · Standard tax invoice' : 'B2C · Tax invoice'}</b></span>
          <span>Invoice UUID: <code>{doc.einv?.uuid}</code></span>
          <span>Currency: OMR</span>
        </div>
        <section className="cd-party">
          <div className="cd-cap">Bill to / العميل</div>
          <div className="ci-big">{doc.party}</div>
          {doc.party_details && <div className="ci-pre">{doc.party_details}</div>}
          {doc.party_vat && <div>Buyer VAT No. / الرقم الضريبي: <b>{doc.party_vat}</b></div>}
        </section>
        <table className="cd-t">
          <thead><tr><th className="c-no">S.No</th><th className="c-desc">Description<span className="ei-thar">الوصف</span></th><th className="c-qty">Qty<span className="ei-thar">الكمية</span></th><th className="c-amt c-price">Unit price<span className="ei-thar">سعر الوحدة</span></th><th className="c-amt">Amount (OMR)<span className="ei-thar">المبلغ بدون ضريبة</span></th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="c-no">{i + 1}</td>
                <td className="ci-pre">{it.desc}</td>
                <td className="c-qty">{it.qty ?? ''}</td>
                <td className="c-amt">{it.price !== undefined && it.price !== '' ? f3(it.price) : ''}</td>
                <td className="c-amt">{f3(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <section className="cd-sum">
          <div className="cd-words"><span className="cd-cap">Amount in words</span>{omrInWords(tot)}</div>
          <dl>
            <dt>Subtotal</dt><dd>{f3(lines)} OMR</dd>
            {disc !== 0 && <><dt>Discount</dt><dd>{f3(disc)} OMR</dd><dt>Net Total</dt><dd>{f3(sub)} OMR</dd></>}
            <dt>VAT {Number(doc.vat_pct) || 0}%</dt><dd>{f3(vat)} OMR</dd>
            <dt className="cd-tot">Total</dt><dd className="cd-tot">{f3(tot)} OMR</dd>
          </dl>
        </section>
        {doc.notes && <p className="ci-pre ci-notes">{doc.notes}</p>}
        <footer className="cd-sign">
          <div><SignStamp value={doc.signs} className="cd-ss" /><div className="cd-line" /><span>Authorised signature</span>{doc.signatory && <b>{doc.signatory}</b>}</div>
          <div><div className="cd-line" /><span>Received by (client)</span></div>
        </footer>
      </article>
      )}
    </main>
  );
}
