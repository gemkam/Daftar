'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AuthGate, { useUser } from '@/components/AuthGate';
import Omr from '@/components/Omr';
import Modal from '@/components/Modal';
import { Viewer } from '@/components/DocFiles';
import { sb } from '@/lib/supabase';
import { COMPANIES, companyOf } from '@/lib/expenses';
import { billTotal } from '@/lib/billCheck';
import { shortOf } from '@/lib/docShort';
import { fmtFullDate } from '@/lib/sheet';
import { chairmanOf, chairmanForUser, canOpenChairman, chairmanCovers, verifierName } from '@/lib/chairmen';
import { canEnterLead } from '@/lib/leadStaff';

/*
  👑 Chairman › Khalid Nasser › ✅ Approvals (6 Nov 2026, Owner: only for Khalid Nasser).
  Bills (company_docs kind 'receipt') that Faisal verified (verify.status 'verified').
  Tabs: Waiting for approval · Approved · Rejected. Buttons ✅ Approve / ✗ Reject (optional note) / ↶ Undo.
  9 Nov 2026 (Owner): Approve / Reject is the FIRST column (before Bill paper); tick bills and "✅ Approve selected",
  or "☑ Select all" / "✅ Approve all". One Undo step brings back the whole group.
  Saved in company_docs.approval {status 'approved'|'rejected', by, at, note}.
  DB trigger guard_bill_verify: ONLY the login khalid@daftar.local can change approval (others see the list, buttons off).
*/
const TABS = [['wait', '⏳ Waiting for approval'], ['approved', '✅ Approved'], ['rejected', '✗ Rejected']];
const when = (s) => { try { return new Date(s).toLocaleString('en-GB', { timeZone: 'Asia/Muscat', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const stateOf = (d) => d.approval?.status === 'approved' ? 'approved' : d.approval?.status === 'rejected' ? 'rejected' : 'wait';

function Approvals() {
  const { key } = useParams();
  const user = useUser();
  const c = chairmanOf(key);
  const me = chairmanForUser(user);
  const canAct = !!(c?.approvals && me?.key === c.key);
  const [docs, setDocs] = useState(null);
  const [tab, setTab] = useState('wait');
  const [co, setCo] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [rej, setRej] = useState(null); // { d, note }
  const [view, setView] = useState(null);
  const [undo, setUndo] = useState([]); // [{ items: [{ id, prev }], label }]
  const [sel, setSel] = useState([]); // ticked bill ids (Waiting tab)

  const flash = (text, kind = 'ok') => { setMsg({ text, kind }); setTimeout(() => setMsg(null), 4000); };

  const load = useCallback(async () => {
    const { data, error } = await sb().from('company_docs').select('*').eq('kind', 'receipt').order('doc_date', { ascending: false });
    if (error) { flash(error.message, 'err'); setDocs([]); return; }
    setDocs((data || []).filter((d) => d.verify?.status === 'verified' && chairmanCovers(chairmanOf(key), d.company)));
  }, [key]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSel([]); }, [tab, co]);

  async function save(d, next, text) {
    setBusy(d.id);
    const { error } = await sb().from('company_docs').update({ approval: next }).eq('id', d.id);
    setBusy('');
    if (error) { flash(error.code === '42501' ? `Only ${c.name} can approve these bills.` : error.message, 'err'); return false; }
    setUndo((u) => [...u.slice(-29), { items: [{ id: d.id, prev: d.approval || null }], label: d.doc_no }]);
    setSel((x) => x.filter((i) => i !== d.id));
    flash(text);
    await load();
    return true;
  }
  const approve = (d) => save(d, { status: 'approved', by: c.name, at: new Date().toISOString() }, `${d.doc_no} approved.`);
  const reject = async () => { if (await save(rej.d, { status: 'rejected', by: c.name, at: new Date().toISOString(), note: rej.note.trim() }, `${rej.d.doc_no} rejected.`)) setRej(null); };
  const back = (d) => save(d, null, `${d.doc_no} is back to Waiting for approval.`);
  async function undoLast() {
    const last = undo[undo.length - 1];
    if (!last) return;
    setBusy('undo');
    for (const it of last.items) {
      const { error } = await sb().from('company_docs').update({ approval: it.prev }).eq('id', it.id);
      if (error) { setBusy(''); flash(error.message, 'err'); return; }
    }
    setBusy('');
    setUndo((u) => u.slice(0, -1));
    flash(`Undone: ${last.label}`);
    load();
  }

  // ✅ Approve many at once (selected or all shown)
  async function approveMany(list) {
    if (!list.length) return;
    if (!window.confirm(`Approve ${list.length} bill${list.length > 1 ? 's' : ''}?`)) return;
    setBusy('many');
    const next = { status: 'approved', by: c.name, at: new Date().toISOString() };
    const { error } = await sb().from('company_docs').update({ approval: next }).in('id', list.map((d) => d.id));
    setBusy('');
    if (error) { flash(error.code === '42501' ? `Only ${c.name} can approve these bills.` : error.message, 'err'); return; }
    setUndo((u) => [...u.slice(-29), { items: list.map((d) => ({ id: d.id, prev: d.approval || null })), label: `${list.length} bills approved` }]);
    setSel([]);
    flash(`${list.length} bill${list.length > 1 ? 's' : ''} approved.`);
    load();
  }

  const shown = useMemo(() => (docs || []).filter((d) => stateOf(d) === tab && (!co || d.company === co)), [docs, tab, co]);
  const count = (t) => (docs || []).filter((d) => stateOf(d) === t && (!co || d.company === co)).length;
  const total = shown.reduce((t, d) => t + billTotal(d), 0);
  const ticks = canAct && tab === 'wait';
  const picked = shown.filter((d) => sel.includes(d.id));
  const allOn = shown.length > 0 && picked.length === shown.length;
  const tickAll = () => setSel(allOn ? [] : shown.map((d) => d.id));

  if (!c) return <p className="empty">General Manager not found. <Link href="/chairman">Back to General Manager</Link></p>;
  if (!c.approvals || !canOpenChairman(user, c.key) || !canEnterLead(user, c.username)) return <p className="empty">Approvals are only for the general managers.</p>;

  return (
    <>
      <h1>✅ Approvals</h1>
      <p className="sub">{c.name} · {c.co ? 'Deputy General Manager' : 'General Manager'} · Bills verified by Faisal / Hamad{!canAct ? ` · Only ${c.name} can press the buttons` : ''}</p>

      <div className="co-switch no-print" role="tablist" aria-label="Approvals">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label} <small className="pn-count">{docs ? count(k) : ''}</small>
          </button>
        ))}
      </div>

      {/* 9 Nov 2026 (Owner): companies as tabs + one button for all companies together */}
      <div className="co-switch ap-cos no-print" role="tablist" aria-label="Company">
        <button type="button" role="tab" aria-selected={!co} className={!co ? 'on' : ''} onClick={() => setCo('')}>
          🏢 All companies <small className="pn-count">{docs ? (docs || []).filter((d) => stateOf(d) === tab).length : ''}</small>
        </button>
        {COMPANIES.filter((x) => chairmanCovers(c, x.key)).map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={co === x.key} className={co === x.key ? 'on' : ''} onClick={() => setCo(x.key)} title={x.name}>
            {x.short} <small className="pn-count">{docs ? (docs || []).filter((d) => stateOf(d) === tab && d.company === x.key).length : ''}</small>
          </button>
        ))}
      </div>

      <div className="page-tools no-print">
        <div className="tools">
          {ticks && shown.length > 0 && (
            <>
              <button type="button" className="btn" onClick={tickAll}>{allOn ? '☐ Untick all' : '☑ Select all'}</button>
              <button type="button" className="btn ap-go" disabled={!picked.length || !!busy} onClick={() => approveMany(picked)}>✅ Approve selected{picked.length ? ` (${picked.length})` : ''}</button>
              <button type="button" className="btn ap-go" disabled={!!busy} onClick={() => approveMany(shown)}>✅ Approve all ({shown.length})</button>
            </>
          )}
          {canAct && <button type="button" className="btn" disabled={!undo.length || !!busy} onClick={undoLast}>↶ Undo{undo.length ? ` (${undo.length})` : ''}</button>}
          <span className="muted">{shown.length} bills · Total <Omr v={total} /></span>
        </div>
      </div>

      {msg && <div className={`toast ${msg.kind}`} role="status">{msg.text}</div>}

      {!docs ? <div className="loading">Loading...</div> : shown.length === 0 ? (
        <p className="empty">{tab === 'wait' ? 'No bills waiting for approval.' : tab === 'approved' ? 'No approved bills yet.' : 'No rejected bills.'}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {ticks && <th className="ap-first"><label className="ap-tick"><input type="checkbox" checked={allOn} onChange={tickAll} aria-label="Select all" /> Approve</label></th>}
                <th>Bill paper</th><th>Company</th><th>No.</th><th>Date</th><th>Paid to</th><th>Receipt No.</th><th>Vehicle No.</th><th>Amount</th><th>Verified by</th><th>{tab === 'wait' ? 'General Manager' : tab === 'approved' ? 'Approved' : 'Rejected'}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => {
                const x = shortOf(d);
                const f = (d.files || [])[0];
                return (
                  <tr key={d.id} className={sel.includes(d.id) ? 'ap-on' : ''}>
                    {ticks && (
                      <td className="ap-first">
                        <span className="ap-cell">
                          <input type="checkbox" checked={sel.includes(d.id)} aria-label={`Select ${d.doc_no}`}
                            onChange={(e) => setSel((x) => (e.target.checked ? [...x, d.id] : x.filter((i) => i !== d.id)))} />
                          <button type="button" className="btn small" disabled={busy === d.id || busy === 'many'} onClick={() => approve(d)}>✅ Approve</button>
                          <button type="button" className="btn small ghost" disabled={busy === d.id || busy === 'many'} onClick={() => setRej({ d, note: '' })}>✗ Reject</button>
                        </span>
                      </td>
                    )}
                    <td>{f ? <button type="button" className="btn small ghost" onClick={() => setView(f)}>📄 View</button> : <span className="muted">No paper</span>}</td>
                    <td>{companyOf(d.company).short}</td>
                    <td><Link href={`/expenses/docs?co=${d.company}&kind=receipt`}>{d.doc_no}</Link></td>
                    <td>{d.doc_date ? fmtFullDate(d.doc_date) : ''}</td>
                    <td>{d.party || ''}</td>
                    <td>{x.receipt_no || ''}</td>
                    <td>{x.vehicle_no || ''}</td>
                    <td><Omr v={billTotal(d)} /></td>
                    <td><small>{d.verify?.by || verifierName(d.company)} · {when(d.verify?.at)}</small></td>
                    <td>
                      {tab === 'wait' ? <span className="muted">Waiting for {c.name}</span> : (
                        <span>
                          <small>{when(d.approval?.at)}{d.approval?.note ? ` · ${d.approval.note}` : ''}</small>
                          {canAct && <> <button type="button" className="btn small ghost" disabled={busy === d.id} onClick={() => back(d)}>↶ Undo</button></>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rej && (
        <Modal title={`✗ Reject ${rej.d.doc_no}`} onClose={() => setRej(null)}>
          <label>Reason (optional)
            <textarea rows={3} value={rej.note} onChange={(e) => setRej({ ...rej, note: e.target.value })} />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={() => setRej(null)}>Cancel</button>
            <button type="button" className="btn danger" disabled={busy === rej.d.id} onClick={reject}>✗ Reject</button>
          </div>
        </Modal>
      )}
      {view && <Viewer file={view} onClose={() => setView(null)} flash={flash} />}
    </>
  );
}

export default function Page() {
  return <AuthGate wide><Approvals /></AuthGate>;
}
