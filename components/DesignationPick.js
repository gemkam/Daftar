'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { sb } from '@/lib/supabase';
import { isRightPassword } from '@/lib/editLock';

/*
  Designation of a login (Owner 11 Nov 2026, Admin › Create users): Employee, CEO, Chairman, Partner.
  More than one can be ticked (some have two designations); saved as "CEO, Partner".
  ＋ adds a new designation, straight away (no password in Daftar).
  Options: app_settings key "designations" (JSON list). The user's designation: table user_designations.
*/
export const DEFAULT_DESIGNATIONS = ['Employee', 'CEO', 'Chairman', 'Partner'];
const KEY = 'designations';

export async function loadDesignations() {
  const { data } = await sb().from('app_settings').select('value').eq('key', KEY).maybeSingle();
  try {
    const v = JSON.parse(data?.value || 'null');
    if (Array.isArray(v) && v.length) return [...v, ...DEFAULT_DESIGNATIONS.filter((d) => !v.includes(d))];
  } catch { /* ignore */ }
  return DEFAULT_DESIGNATIONS;
}

export async function saveUserDesignation(userId, designation) {
  if (Array.isArray(designation)) designation = designation.join(', ');
  if (!userId || !designation) return;
  const { error } = await sb().from('user_designations').upsert({ user_id: userId, designation, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function designationsByUser() {
  const { data } = await sb().from('user_designations').select('user_id, designation');
  return Object.fromEntries((data || []).map((r) => [r.user_id, r.designation]));
}

/* value = list of designations (one or more) */
export default function DesignationPick({ id, value, onChange }) {
  const picked = Array.isArray(value) ? value : value ? [value] : [];
  const toggle = (d) => onChange(picked.includes(d) ? picked.filter((x) => x !== d) : [...picked, d]);
  const [list, setList] = useState(DEFAULT_DESIGNATIONS);
  const [add, setAdd] = useState(null); // { pw, name, ok, err }
  useEffect(() => { loadDesignations().then(setList).catch(() => {}); }, []);

  async function typedPw(v) {
    const ok = !!v && await isRightPassword(v);
    setAdd((a) => ({ ...a, pw: v, ok, err: '' }));
  }

  async function saveNew(e) {
    e.preventDefault();
    if (!add.ok) { setAdd({ ...add, err: 'Wrong password' }); return; }
    const name = String(add.name || '').trim();
    if (!name) { setAdd({ ...add, err: 'Type the designation' }); return; }
    const have = list.find((x) => x.toLowerCase() === name.toLowerCase());
    if (have) { if (!picked.includes(have)) onChange([...picked, have]); setAdd(null); return; }
    const next = [...list, name];
    const { error } = await sb().from('app_settings').upsert({ key: KEY, value: JSON.stringify(next), updated_at: new Date().toISOString() });
    if (error) { setAdd({ ...add, err: error.message }); return; }
    setList(next); onChange([...picked, name]); setAdd(null);
  }

  return (
    <>
      <div className="cu-row">
        <div id={id} className="dg-list" role="group" aria-label="Designation (one or more)">
          {list.map((d) => (
            <label key={d} className={`dg-opt${picked.includes(d) ? ' on' : ''}`}>
              <input type="checkbox" checked={picked.includes(d)} onChange={() => toggle(d)} /> {d}
            </label>
          ))}
        </div>
        <button type="button" className="btn" onClick={() => setAdd({ pw: '', name: '', ok: true, err: '' })} title="Add a designation">＋</button>
      </div>
      {add && (
        <Modal title="＋ Add designation" onClose={() => setAdd(null)}>
          <form onSubmit={saveNew} style={{ display: 'grid', gap: 12 }}>
            {add.ok && (
              <div className="field">
                <label htmlFor="dg-name">New designation</label>
                <input id="dg-name" autoFocus value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="e.g. Manager" />
              </div>
            )}
            {add.err && <div className="error">{add.err}</div>}
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setAdd(null)}>Cancel</button>
              <button type="submit" className="btn in" disabled={!add.ok}>＋ Add</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
