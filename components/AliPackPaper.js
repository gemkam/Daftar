'use client';

import DateInput from '@/components/DateInput';
import SignStamp from '@/components/SignStamp';
import { fmt3 } from '@/components/Omr';
import { fmtFullDate } from '@/lib/sheet';
import { omrInWords } from '@/lib/words';
import { buyerType, totalsOf, SHOW_GOVT_QR } from '@/lib/einvoice';

/*
  🦁 ALI PACK invoice paper (Owner 11 Nov 2026): the Ali Pack letterhead from its Excel (Invoice tab) and the
  Barq PDF: logo on top, blue title bar, company + VAT TIN, Invoice # and SALES REP, Date, Customer, section bar,
  Item No. | Description | Quantity | Unit Price (OMR) | Total (OMR), Subtotal / Discount / Net Total / VAT / Grand Total,
  Bank Details, thank-you line, Authorized Signatory, Terms & Conditions, address at the foot.
  Plus the same Govt e-invoice (Fawtara) parts as every company invoice: Arabic, time of issue, UUID, B2B / B2C, QR.
  Every text of the letterhead is editable (saved with the invoice in lh); a new invoice takes the texts of the last one.
  Discount and Net Total rows are hidden in the Excel; here they show while editing and on paper only when a discount is typed.
*/
export const AP_LH = {
  section: 'Invoice',
  rep_label: 'SALES REP',
  rep: 'SALES',
  bank_title: 'Bank Details:',
  bank: [['Name', 'Sample Company LLC'], ['Bank  ', 'Sample Bank'], ['Account No', '0000000000'], ['IBAN  ', 'OM000000000000000000000']],
  thanks: 'Thank you for considering our quotation. For any inquiries, please contact us.',
  sign_title: 'Authorized Signatory',
  sign_name: 'General Manager',
  sign_co: 'Sample Company LLC',
  terms_title: 'Terms & Conditions:',
  terms: [
    'Quotation Validity: One  Week',
    'Delivery Time: 10 to 15 Days following approval of final sample. ',
    'Deliveries may be delayed due to external factors including but not limited to regulatory changes and inclement weather.',
    'Payment Terms: 50% advance prior to sampling. Balance 50% payment within maximum 7 days of delivery.',
    'Shipped Via: Land to Muscat Customer Business Store. Additional costs may apply to shipping outside of Muscat.',
    'Note: All cheques to be payable to Sample Company LLC',
    'Delivered printed goods may vary by 5-10% compared to any digital or physical samples.'
  ],
  footer: 'Muscat, Sultanate of Oman'
};
export const apLh = (doc) => ({ ...AP_LH, ...(doc?.lh || {}) });

const n = (v) => Number(v || 0);

export default function AliPackPaper({
  doc, S, C, ro = true, when, viewQr = '', qrUrl = '', paperRef = null,
  set = null, setItem = null, addItem = null, removeItem = null, pickParty = null, parties = [], flash = null, client = false
}) {
  const lh = apLh(doc);
  const setLh = (k, v) => set && set('lh', { ...lh, [k]: v });
  const { items: sub, disc, sub: net, vat, tot } = totalsOf(doc);
  const showDisc = !ro || disc !== 0;
  const txt = (k, cls = '', area = false) => {
    if (ro) return <span className={`ap-t ${cls}`}>{lh[k]}</span>;
    return area
      ? <textarea className={`cd-in ap-in ${cls}`} rows={1} value={lh[k]} onChange={(e) => setLh(k, e.target.value)} />
      : <input className={`cd-in ap-in ${cls}`} value={lh[k]} onChange={(e) => setLh(k, e.target.value)} />;
  };
  const listTxt = (k, i, j = null) => {
    const v = j === null ? lh[k][i] : lh[k][i][j];
    if (ro) return <span className="ap-t">{v}</span>;
    const change = (val) => {
      const arr = lh[k].map((x) => (Array.isArray(x) ? [...x] : x));
      if (j === null) arr[i] = val; else arr[i][j] = val;
      setLh(k, arr);
    };
    return <input className="cd-in ap-in" value={v} onChange={(e) => change(e.target.value)} />;
  };
  const items = client ? (doc.items || []).filter((i) => String(i.desc || '').trim() || n(i.amount)) : (doc.items || []);

  return (
    <article ref={paperRef} className={`cd-paper k-invoice einv ap-paper${ro ? ' ro' : ''}${client ? ' ci-paper' : ''}`}>
      <div className="ap-logo-row">{C.logo && <img className="ap-logo" src={C.logo} alt={C.short} />}</div>
      <div className="ap-bar">TAX INVOICE <span className="ei-ar" dir="rtl" lang="ar">فاتورة ضريبية</span></div>

      <header className="ap-head">
        <div className="ap-co">
          <div>{S.name_en || C.name}</div>
          {S.name_ar && <div className="ei-ar" dir="rtl" lang="ar">{S.name_ar}</div>}
          <div>{S.address || C.address}</div>
          <div>VAT TIN: {S.vat}{S.cr ? ` · CR: ${S.cr}` : ''}</div>
        </div>
        <table className="ap-meta"><tbody>
          <tr><td>Invoice #: <small className="ei-ar">الرقم</small></td><td>{ro ? doc.doc_no : <input className="cd-in ap-in" value={doc.doc_no || ''} onChange={(e) => set('doc_no', e.target.value)} />}</td></tr>
          <tr><td>{txt('rep_label')}</td><td>{txt('rep')}</td></tr>
          <tr><td>Date: <small className="ei-ar">التاريخ</small></td><td>{ro ? (doc.doc_date ? fmtFullDate(doc.doc_date) : '') : <DateInput className="cd-in ap-in" value={doc.doc_date || ''} onChange={(v) => set('doc_date', v)} />}</td></tr>
          {doc.einv?.issued_at && <tr><td>Time: <small className="ei-ar">الوقت</small></td><td>{when?.time}</td></tr>}
        </tbody></table>
      </header>

      <div className="ei-strip">
        <span><b>{buyerType(doc) === 'B2B' ? 'B2B · Standard tax invoice' : 'B2C · Tax invoice'}</b></span>
        <span>Invoice UUID: <code>{doc.einv?.uuid || 'made when you save'}</code></span>
        <span>Currency: OMR</span>
      </div>

      <section className="ap-cust">
        <div className="ap-cap">Customer: <small className="ei-ar">العميل</small></div>
        {ro ? <div className="ap-cust-name">{doc.party}</div> : (
          <>
            <input className="cd-in cd-big" list="cd-parties" placeholder="Customer name" value={doc.party || ''} onChange={(e) => pickParty(e.target.value)} />
            <datalist id="cd-parties">{parties.map((p) => <option key={p} value={p} />)}</datalist>
          </>
        )}
        {ro ? (doc.party_details ? <div className="ci-pre">{doc.party_details}</div> : null)
          : <textarea className="cd-in cd-area" rows={2} placeholder="e.g. Muscat, Oman (address, phone, email)" value={doc.party_details || ''} onChange={(e) => set('party_details', e.target.value)} />}
        {ro ? (doc.party_vat ? <div>Buyer VAT No. / الرقم الضريبي: <b>{doc.party_vat}</b></div> : null) : (
          <label className="cd-inline"><span>Buyer VAT No. / الرقم الضريبي</span><input className="cd-in" placeholder="OM + 10 digits (empty = B2C)" value={doc.party_vat || ''} onChange={(e) => set('party_vat', e.target.value)} /></label>
        )}
      </section>

      <div className="ap-sec">{txt('section')}</div>

      <table className="ap-t-items">
        <thead><tr>
          <th className="c-no">Item No.</th><th>Description<span className="ei-thar">الوصف</span></th><th className="c-qty">Quantity<span className="ei-thar">الكمية</span></th>
          <th className="c-amt">Unit Price (OMR)<span className="ei-thar">سعر الوحدة</span></th><th className="c-amt">Total (OMR)<span className="ei-thar">المجموع</span></th>
          {!ro && <th className="c-x no-print" />}
        </tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className="c-no">{i + 1}</td>
              <td>{ro ? <span className="ap-desc">{it.desc}</span> : <textarea className="cd-in cd-desc" rows={1} value={it.desc} placeholder="Description" onChange={(e) => setItem(i, 'desc', e.target.value)} />}</td>
              <td className="c-qty">{ro ? (it.qty === '' || it.qty === undefined || it.qty === null ? '-' : it.qty)
                : <input className="cd-in cd-num" inputMode="decimal" value={it.qty ?? ''} placeholder="0" onChange={(e) => setItem(i, 'qty', e.target.value.replace(/[^\d.]/g, ''))} />}</td>
              <td className="c-amt">{ro ? (it.price === '' || it.price === undefined || it.price === null ? '-' : fmt3(it.price))
                : <input className="cd-in cd-num" inputMode="decimal" value={it.price ?? ''} placeholder="0.000" onChange={(e) => setItem(i, 'price', e.target.value.replace(/[^\d.]/g, ''))} />}</td>
              <td className="c-amt">{ro ? (it.amount === '' || it.amount === undefined || it.amount === null ? '-' : fmt3(it.amount))
                : <input className="cd-in cd-num" inputMode="decimal" value={it.amount ?? ''} placeholder="0.000"
                  onChange={(e) => setItem(i, 'amount', e.target.value.replace(/[^\d.]/g, ''))}
                  onBlur={(e) => e.target.value !== '' && setItem(i, 'amount', (Math.round(n(e.target.value) * 1000) / 1000).toFixed(3))} />}</td>
              {!ro && <td className="c-x no-print"><button type="button" className="cd-x" onClick={() => removeItem(i)} aria-label={`Remove line ${i + 1}`}>×</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!ro && <button type="button" className="btn small ghost no-print cd-add" onClick={addItem}>+ Add line</button>}

      <section className="ap-sum">
        <div className="ap-words">
          <span className="cd-cap">Amount in words</span>{omrInWords(tot)}
          {!client && <div className="ei-qr-row">
            <div className="ei-qr">
              {viewQr ? <img src={viewQr} alt="Scan to view this invoice" /> : <span className="ei-qr-empty">QR code after Save</span>}
              <small><b>Scan to view and download this invoice</b></small>
            </div>
            {SHOW_GOVT_QR && (
              <div className="ei-qr">
                {qrUrl ? <img src={qrUrl} alt="E-invoice QR code" /> : <span className="ei-qr-empty">QR code after Save</span>}
                <small>Govt e-invoice QR</small>
              </div>
            )}
          </div>}
        </div>
        <table className="ap-tot"><tbody>
          <tr><td>Subtotal:</td><td>OMR.</td><td>{fmt3(sub)}</td></tr>
          {showDisc && <tr className={ro ? '' : 'ap-hidden-row'}><td>Discount{!ro && <small className="no-print"> (type minus, e.g. -2.500)</small>}</td><td>OMR.</td>
            <td>{ro ? fmt3(disc) : <input className="cd-in cd-num" inputMode="decimal" value={doc.discount ?? ''} placeholder="0.000" onChange={(e) => set('discount', e.target.value.replace(/[^\d.-]/g, ''))} />}</td></tr>}
          {showDisc && <tr className={ro ? '' : 'ap-hidden-row'}><td>Net Total</td><td>OMR.</td><td>{fmt3(net)}</td></tr>}
          <tr><td>VAT @ {ro ? `${n(doc.vat_pct)}%` : (
            <select className="cd-vat" value={String(n(doc.vat_pct))} onChange={(e) => set('vat_pct', Number(e.target.value))}>
              <option value="5">5%</option><option value="0">0%</option>
            </select>)}: </td><td>OMR.</td><td>{fmt3(vat)}</td></tr>
          <tr className="ap-grand"><td>Grand Total:</td><td>OMR.</td><td>{fmt3(tot)}</td></tr>
        </tbody></table>
      </section>

      {ro ? (doc.notes ? <p className="ci-pre ci-notes">{doc.notes}</p> : null)
        : <textarea className={`cd-in cd-notes${doc.notes ? '' : ' is-empty'}`} rows={2} placeholder="Notes (optional)" value={doc.notes || ''} onChange={(e) => set('notes', e.target.value)} />}

      <section className="ap-bank">
        <div>{txt('bank_title')}</div>
        <table><tbody>
          {lh.bank.map((r, i) => <tr key={i}><td>{listTxt('bank', i, 0)}</td><td>{listTxt('bank', i, 1)}</td></tr>)}
        </tbody></table>
      </section>
      <p className="ap-thanks">{txt('thanks', 'ap-wide')}</p>

      <section className="ap-signs">
        <div className="ap-sign-left">
          <div>{txt('sign_title')}</div>
          <div className="ap-sign-gap" />
          <div>{txt('sign_name')}</div>
          <div>{txt('sign_co', 'ap-wide')}</div>
        </div>
        <SignStamp value={doc.signs} onChange={ro ? null : (v) => set('signs', v)} flash={flash} className="ap-ss" />
      </section>

      <section className="ap-terms">
        <div>{txt('terms_title')}</div>
        {lh.terms.map((t, i) => <div key={i}>{listTxt('terms', i)}</div>)}
      </section>
      <footer className="ap-foot">{txt('footer', 'ap-wide')}</footer>
    </article>
  );
}
