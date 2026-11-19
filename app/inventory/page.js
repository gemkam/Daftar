'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGate, { useUser } from '@/components/AuthGate';
import { invCoFromUrl, byCo, coQ, invTitle, invCompanies } from '@/lib/inventoryCo';
import { useMyCompanyKeys } from '@/lib/myCompanies';
import { companyOf } from '@/lib/expenses';
import { sb, isLow } from '@/lib/supabase';

function bySort(a, b) {
  return (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name);
}

function InventoryHome() {
  const [cats, setCats] = useState(null);
  const [bills, setBills] = useState([]);
  const [error, setError] = useState('');
  const [co, setCo] = useState(invCoFromUrl); // '' = shared Inventory; 'ali-pack' / 'barq-express' = that company's own
  const U = useUser();
  const { isAdmin } = U;
  /* 13 Nov 2026 (Owner): Hamad and Salim manage their OWN company inventory (Ali Pack, Barq Express), not the main one
     of Faisal and Khalid. Users without All companies open their first own inventory; buttons switch between the
     inventories, the ones they have no access to are greyed. */
  const keys = useMyCompanyKeys(U);
  const all = keys === 'all';
  const mineInv = invCompanies().filter((k) => all || (keys || []).includes(k));
  const choices = [{ key: '', label: '🏢 Main inventory', ok: all }, ...invCompanies().map((k) => ({ key: k, label: `📦 ${companyOf(k)?.short || k}`, ok: mineInv.includes(k) }))];
  useEffect(() => {
    if (keys === null || all || co) return;
    if (mineInv[0]) pick(mineInv[0]);
  }, [keys]); // eslint-disable-line react-hooks/exhaustive-deps
  function pick(k) {
    setCats(null); setCo(k);
    try { window.history.replaceState(null, '', `/inventory${coQ(k)}`); } catch { /* ignore */ }
  }
  const waiting = keys === null || (!all && !co && mineInv.length > 0);
  const [add, setAdd] = useState(null); // { kind: 'cat' | 'acc', name }
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const s = sb();
      const [c, b] = await Promise.all([
        byCo(s.from('categories').select('id, name, sort, items(id, name, unit, quantity, min_qty, sort)'), co).order('sort').order('name'),
        byCo(s.from('bill_accounts').select('id, name, payment_type, sort'), co).order('sort').order('name')
      ]);
      if (c.error || b.error) setError((c.error || b.error).message);
      setCats((c.data || []).map((cat) => ({ ...cat, items: (cat.items || []).sort(bySort) })));
      setBills(b.data || []);
    })();
  }, [co, tick]);
  const noInv = keys !== null && !all && mineInv.length === 0;

  async function saveAdd(e) {
    e.preventDefault();
    const name = String(add?.name || '').trim();
    if (!name) return;
    const list = add.kind === 'cat' ? cats : bills;
    const sort = list.reduce((m, x) => Math.max(m, x.sort || 0), 0) + 1;
    const { error: err } = await sb().from(add.kind === 'cat' ? 'categories' : 'bill_accounts').insert({ name, sort, company: co });
    if (err) { setError(err.code === '23505' ? 'That name already exists.' : err.message); return; }
    setError(''); setAdd(null); setTick((t) => t + 1);
  }

  if (noInv) return <p className="empty center">You have no inventory yet. Ask the Administrator.</p>;
  if (!cats || waiting) return <div className="loading">Loading inventory...</div>;

  const lowItems = cats.flatMap((c) => c.items.filter(isLow).map((i) => ({ ...i, category: c.name, category_id: c.id })));

  return (
    <>
      <div className="page-tools">
        <Link href={co ? `/company/${co}` : '/'} className="crumb">{co ? '← Company' : '← Home'}</Link>
        <div className="tools">
          <Link href={`/inventory/reports${coQ(co)}`} className="btn report">📊 Reports</Link>
          <Link href={`/log${coQ(co)}`} className="btn ghost">Stock log</Link>
          {co && isAdmin && <button type="button" className="btn ghost" onClick={() => setAdd({ kind: 'cat', name: '' })}>＋ New section</button>}
          {co && isAdmin && <button type="button" className="btn ghost" onClick={() => setAdd({ kind: 'acc', name: '' })}>＋ New bill account</button>}
        </div>
      </div>
      <h1 className="center">{invTitle(co)}</h1>
      <div className="co-switch no-print inv-switch" role="tablist" aria-label="Inventory">
        {choices.map((c) => (
          <button key={c.key || 'main'} type="button" role="tab" aria-selected={co === c.key} disabled={!c.ok}
            className={`${co === c.key ? 'on' : ''}${c.ok ? '' : ' co-off'}`} title={c.ok ? undefined : 'No access to this inventory'}
            onClick={() => c.ok && co !== c.key && pick(c.key)}>{c.label}</button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      {add && (
        <form className="panel inv-add" onSubmit={saveAdd}>
          <label>{add.kind === 'cat' ? 'New section name (for example Office Supplies)' : 'New bill account name (for example Electricity)'}
            <input autoFocus value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
          </label>
          <button type="submit" className="btn">💾 Save</button>
          <button type="button" className="btn ghost" onClick={() => setAdd(null)}>Cancel</button>
        </form>
      )}
      {co && cats.length === 0 && !add && <p className="empty center">No sections yet. Tap ＋ New section to start this inventory.</p>}

      <div className="tiles">
        {cats.map((c) => {
          const low = c.items.filter(isLow).length;
          return (
            <div className="tile-wrap" key={c.id}>
              <Link href={`/c/${c.id}`} className="tile">
                <span>{c.name}</span>
                <span className="count">{c.items.length} items</span>
                {low > 0 && <span className="low-badge">{low} low</span>}
              </Link>
              <div className="drop">
                <ul>
                  {c.items.length === 0 && <li>No items yet</li>}
                  {c.items.map((i) => (
                    <li key={i.id} className={isLow(i) ? 'low' : ''}>
                      <span>{i.name}</span>
                      <span className="q">{Number(i.quantity)} {i.unit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}

        <div className="tile-wrap">
          <Link href={`/bills${coQ(co)}`} className="tile">
            <span>Bills</span>
            <span className="count">{bills.length} accounts</span>
          </Link>
          <div className="drop">
            <ul>
              {bills.map((b) => (
                <li key={b.id}>
                  <span>{b.name}</span>
                  <span className="q">{b.payment_type || ''}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <section className="panel">
        <h2>Low stock</h2>
        {lowItems.length === 0 ? (
          <p className="empty">Nothing is below its minimum level. Administrator can set a minimum on each item to get alerts here.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Item</th><th>Category</th><th className="num">In stock</th><th className="num">Minimum</th></tr>
              </thead>
              <tbody>
                {lowItems.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td><Link href={`/c/${i.category_id}`}>{i.category}</Link></td>
                    <td className="num"><span className="pill low">{Number(i.quantity)} {i.unit}</span></td>
                    <td className="num">{Number(i.min_qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function Page() {
  return <AuthGate><InventoryHome /></AuthGate>;
}
