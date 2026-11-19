'use client';

import { useCallback, useEffect, useState } from 'react';
import { sb } from '@/lib/supabase';

/*
  Faisal's display picture (the AI assistant).
  Stored in table app_settings, key "faisal.avatar" (only the Administrator can change it, RLS is_admin()).
    - no row          -> default photo /faisal-avatar.jpg
    - "drawn"         -> the old drawn (cartoon) face
    - "data:image..." -> a picture the Administrator uploaded and cropped
*/
export const AVATAR_KEY = 'faisal.avatar';
export const DEFAULT_AVATAR = '/faisal-avatar.jpg';
const EVENT = 'faisal-avatar-changed';
const CACHE = 'tudo-faisal-avatar';

function readCache() {
  try { return localStorage.getItem(CACHE); } catch { return null; }
}
function writeCache(v) {
  try { if (v === null) localStorage.removeItem(CACHE); else localStorage.setItem(CACHE, v); } catch { /* ignore */ }
}

// value -> what to show: { kind: 'photo', src } or { kind: 'drawn' }
export function avatarView(value) {
  if (value === 'drawn') return { kind: 'drawn' };
  if (value && value.startsWith('data:image')) return { kind: 'photo', src: value };
  return { kind: 'photo', src: DEFAULT_AVATAR };
}

export function useFaisalAvatar() {
  const [value, setValue] = useState(null);

  useEffect(() => {
    const cached = readCache();
    if (cached) setValue(cached === '__default' ? null : cached);
    let alive = true;
    sb().from('app_settings').select('value').eq('key', AVATAR_KEY).maybeSingle()
      .then(({ data, error }) => {
        if (!alive || error) return;
        const v = data?.value || null;
        setValue(v);
        writeCache(v || '__default');
      })
      .catch(() => {});
    const onChange = (e) => setValue(e.detail ?? null);
    window.addEventListener(EVENT, onChange);
    return () => { alive = false; window.removeEventListener(EVENT, onChange); };
  }, []);

  return avatarView(value);
}

// value: data URL, "drawn", or null (= default photo)
export async function saveFaisalAvatar(value) {
  const s = sb();
  const res = value
    ? await s.from('app_settings').upsert({ key: AVATAR_KEY, value, updated_at: new Date().toISOString() })
    : await s.from('app_settings').delete().eq('key', AVATAR_KEY);
  if (res.error) return { error: res.error.message };
  writeCache(value || '__default');
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
  return { ok: true };
}

export function useAvatarSaver() {
  const [busy, setBusy] = useState(false);
  const save = useCallback(async (value) => {
    setBusy(true);
    const r = await saveFaisalAvatar(value);
    setBusy(false);
    return r;
  }, []);
  return { busy, save };
}
