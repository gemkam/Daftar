'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AuthGate, { useUser } from '@/components/AuthGate';
import { sb } from '@/lib/supabase';
import { COMPANIES } from '@/lib/expenses';
import CameraCapture from '@/components/CameraCapture';

/*
  💬 Chat (Owner 11 Nov 2026): company staff and drivers talk to each other.
  - People list (13 Nov 2026): you see only people who share a company with you, plus the Administrators
    (Administrators see everyone). RPC chat_people / chat_can_see in supabase/chat.sql.
  - One group per company (everyone who belongs to that company: given in Company access, its staff, its drivers,
    and the Administrators) and one-to-one chats with anyone who has a login (＋ New chat).
  - Text, 📷 photos (made smaller first) and 🎤 voice notes. Files in the private storage bucket chat-files.
  - New messages come in live (Supabase realtime) and every 8 seconds as a back-up. Unread counts: RPC chat_unread,
    shown on the Chat button in the top bar and on the driver bar (components/AuthGate.js).
  Database: supabase/chat.sql (chat_rooms, chat_members, chat_messages, RPC chat_people / chat_dm / chat_group).
  Drivers open this page too (AuthGate entryPage).
*/

const BUCKET = 'chat-files';
const hhmm = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Muscat' });
const dayOf = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Muscat' });
const initial = (s) => String(s || '?').trim().charAt(0).toUpperCase();
const nice = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1600 / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Photo could not be read'))), 'image/jpeg', 0.85);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Photo could not be read')); };
    im.src = url;
  });
}

const urlCache = new Map();
function useFileUrl(path) {
  const [url, setUrl] = useState(urlCache.get(path) || '');
  useEffect(() => {
    if (!path || urlCache.has(path)) return;
    sb().storage.from(BUCKET).createSignedUrl(path, 3600 * 6).then(({ data }) => {
      if (data?.signedUrl) { urlCache.set(path, data.signedUrl); setUrl(data.signedUrl); }
    });
  }, [path]);
  return url;
}

function Bubble({ m, mine, who, showWho, onDelete }) {
  const url = useFileUrl(m.file_path);
  const [zoom, setZoom] = useState(false);
  return (
    <div className={`ch-msg${mine ? ' mine' : ''}`}>
      <div className="ch-bub">
        {showWho && !mine && <b className="ch-who">{who}</b>}
        {m.kind === 'photo' && (url ? <img src={url} alt="Photo" className="ch-photo" onClick={() => setZoom(true)} /> : <span className="muted">📷 Loading photo...</span>)}
        {m.kind === 'voice' && (url ? <><audio controls preload="metadata" src={url} className="ch-voice" />{m.seconds ? <small className="muted">🎤 {Math.floor(m.seconds / 60)}:{String(Math.round(m.seconds % 60)).padStart(2, '0')}</small> : null}</> : <span className="muted">🎤 Loading voice...</span>)}
        {m.body && <span className="ch-text">{m.body}</span>}
        <span className="ch-meta">{hhmm(m.created_at)}{mine && <button type="button" className="ch-del" title="Delete" onClick={() => onDelete(m)}>🗑</button>}</span>
      </div>
      {zoom && url && <div className="ch-zoom" onClick={() => setZoom(false)} role="dialog" aria-label="Photo"><img src={url} alt="Photo" /></div>}
    </div>
  );
}

function ChatPage() {
  const user = useUser();
  const [people, setPeople] = useState([]);
  const [rooms, setRooms] = useState(null); // [{ id, kind, company, name, last_at, members: [userId] }]
  const [unread, setUnread] = useState({});
  const [open, setOpen] = useState(''); // room id
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pick, setPick] = useState(false); // ＋ New chat list
  const [q, setQ] = useState('');
  const [rec, setRec] = useState(null); // { start, recorder, chunks, stream }
  const [tick, setTick] = useState(0);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const [photoMenu, setPhotoMenu] = useState(false); // 📷 Take photo / Choose photo
  const [cam, setCam] = useState(false); // live camera, front and back (components/CameraCapture.js)

  const byId = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);
  const coShort = (k) => COMPANIES.find((c) => c.key === k)?.short || k || '';

  const loadRooms = useCallback(async () => {
    const s = sb();
    // my company groups (made the first time someone opens Chat)
    await Promise.all(COMPANIES.map((c) => s.rpc('chat_group', { p_company: c.key, p_name: c.short }).then(() => null, () => null)));
    const [r, mem, un] = await Promise.all([
      s.from('chat_rooms').select('id, kind, company, name, last_at').order('last_at', { ascending: false }),
      s.from('chat_members').select('room_id, user_id'),
      s.rpc('chat_unread')
    ]);
    const members = {};
    (mem.data || []).forEach((m) => { (members[m.room_id] ||= []).push(m.user_id); });
    setRooms((r.data || []).map((x) => ({ ...x, members: members[x.id] || [] })));
    setUnread(Object.fromEntries((un.data || []).map((x) => [x.room_id, Number(x.unread)])));
  }, []);

  useEffect(() => {
    sb().rpc('chat_people').then(({ data }) => setPeople(data || []));
    loadRooms();
    const t = setInterval(loadRooms, 20000);
    return () => clearInterval(t);
  }, [loadRooms]);

  const roomName = useCallback((r) => {
    if (!r) return '';
    if (r.kind === 'group') return `👥 ${coShort(r.company) || r.name}`;
    const other = r.members.find((id) => id !== user.id);
    return nice(byId[other]?.name) || 'Chat';
  }, [byId, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = useCallback(async (roomId) => {
    if (!roomId) return;
    await sb().from('chat_members').upsert({ room_id: roomId, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'room_id,user_id' });
    setUnread((u) => ({ ...u, [roomId]: 0 }));
    window.dispatchEvent(new Event('tudo-chat-read'));
  }, [user.id]);

  const loadMsgs = useCallback(async (roomId) => {
    const { data, error } = await sb().from('chat_messages').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).limit(300);
    if (error) { setErr(error.message); return; }
    setMsgs((data || []).reverse());
  }, []);

  // open a room: messages + live updates
  useEffect(() => {
    if (!open) return undefined;
    setMsgs([]); setErr('');
    loadMsgs(open).then(() => markRead(open));
    const ch = sb().channel(`chat-${open}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${open}` }, () => { loadMsgs(open).then(() => markRead(open)); })
      .subscribe();
    const t = setInterval(() => loadMsgs(open), 8000);
    return () => { clearInterval(t); sb().removeChannel(ch); };
  }, [open, loadMsgs, markRead]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, open]);
  useEffect(() => { if (!rec) return undefined; const t = setInterval(() => setTick((x) => x + 1), 500); return () => clearInterval(t); }, [rec]);

  async function startDm(p) {
    setPick(false); setQ('');
    const { data, error } = await sb().rpc('chat_dm', { p_other: p.id });
    if (error) { setErr(error.message); return; }
    await loadRooms();
    setOpen(data);
  }

  async function send(kind, payload = {}) {
    if (!open) return;
    setBusy(true); setErr('');
    const { error } = await sb().from('chat_messages').insert({ room_id: open, user_id: user.id, kind, ...payload });
    setBusy(false);
    if (error) { setErr(error.message); return false; }
    await loadMsgs(open); markRead(open); loadRooms();
    return true;
  }

  async function sendText(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;
    if (await send('text', { body })) setText('');
  }

  async function upload(blob, ext, type) {
    const path = `${open}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb().storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
    if (error) throw error;
    return path;
  }

  // one or more photos (picked, or taken with the camera); the typed text goes with the first one
  async function sendPhotos(files) {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    setBusy(true);
    try {
      for (let i = 0; i < list.length; i += 1) {
        const blob = await shrinkPhoto(list[i]);
        const path = await upload(blob, 'jpg', 'image/jpeg');
        await send('photo', { file_path: path, body: i === 0 ? (text.trim() || null) : null });
      }
      setText('');
    } catch (x) { setErr(x.message || 'Could not send the photo'); }
    setBusy(false);
  }
  async function onPhoto(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    await sendPhotos(files);
  }

  async function startRec() {
    setErr('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setErr('Voice notes do not work in this browser.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      recorder.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
      recorder.start();
      setRec({ start: Date.now(), recorder, chunks, stream });
    } catch { setErr('Allow the microphone to record a voice note.'); }
  }

  function stopRec(sendIt) {
    const r = rec;
    if (!r) return;
    setRec(null);
    r.recorder.onstop = async () => {
      r.stream.getTracks().forEach((t) => t.stop());
      if (!sendIt) return;
      const type = r.recorder.mimeType || 'audio/webm';
      const blob = new Blob(r.chunks, { type });
      const secs = Math.round((Date.now() - r.start) / 1000);
      if (secs < 1 || !blob.size) return;
      setBusy(true);
      try {
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const path = await upload(blob, ext, type.split(';')[0]);
        await send('voice', { file_path: path, seconds: secs });
      } catch (x) { setErr(x.message || 'Could not send the voice note'); }
      setBusy(false);
    };
    r.recorder.stop();
  }

  async function del(m) {
    if (!window.confirm || !confirm('Delete this message?')) return; // eslint-disable-line no-alert
    const { error } = await sb().from('chat_messages').delete().eq('id', m.id);
    if (error) { setErr(error.message); return; }
    if (m.file_path) sb().storage.from(BUCKET).remove([m.file_path]).catch(() => {});
    loadMsgs(open);
  }

  if (!rooms) return <div className="loading">Loading chat...</div>;
  const groups = rooms.filter((r) => r.kind === 'group');
  const dms = rooms.filter((r) => r.kind === 'dm');
  const cur = rooms.find((r) => r.id === open);
  const others = people.filter((p) => p.id !== user.id && (!q || `${p.name} ${p.username} ${coShort(p.company)}`.toLowerCase().includes(q.toLowerCase())));
  const recSecs = rec ? Math.floor((Date.now() - rec.start) / 1000) : 0;
  void tick;

  const Row = ({ r }) => (
    <button type="button" className={`ch-room${open === r.id ? ' on' : ''}`} onClick={() => setOpen(r.id)}>
      <span className="ch-av">{r.kind === 'group' ? '👥' : initial(roomName(r))}</span>
      <span className="ch-rtx"><b>{roomName(r)}</b><small>{r.kind === 'group' ? 'Company group' : coShort(byId[r.members.find((id) => id !== user.id)]?.company) || 'One-to-one'}</small></span>
      {unread[r.id] > 0 && <em className="ch-badge">{unread[r.id]}</em>}
    </button>
  );

  let lastDay = '';
  return (
    <div className={`ch-wrap${open ? ' has-open' : ''}`}>
      <aside className="ch-list">
        <div className="ch-lhead">
          <h1>💬 Chat</h1>
          <button type="button" className="btn" onClick={() => setPick((v) => !v)}>＋ New chat</button>
        </div>
        {pick && (
          <div className="ch-pick">
            <input type="search" placeholder="Search a name" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            <div className="ch-people">
              {others.length === 0 && <p className="muted">Nobody found.</p>}
              {others.map((p) => (
                <button key={p.id} type="button" className="ch-room" onClick={() => startDm(p)}>
                  <span className="ch-av">{initial(p.name)}</span>
                  <span className="ch-rtx"><b>{nice(p.name)}</b><small>{p.role === 'driver' ? 'Driver' : 'Staff'}{p.company ? ` · ${coShort(p.company)}` : ''}</small></span>
                </button>
              ))}
            </div>
          </div>
        )}
        {groups.length > 0 && <div className="ch-cap">Company groups</div>}
        {groups.map((r) => <Row key={r.id} r={r} />)}
        <div className="ch-cap">Chats</div>
        {dms.length === 0 && <p className="muted ch-none">No chats yet. Tap ＋ New chat.</p>}
        {dms.map((r) => <Row key={r.id} r={r} />)}
      </aside>

      <section className="ch-main">
        {!cur ? (
          <div className="ch-empty"><span>💬</span><p>Choose a chat on the left, or tap ＋ New chat.</p></div>
        ) : (
          <>
            <div className="ch-head">
              <button type="button" className="ch-back" onClick={() => setOpen('')} aria-label="Back to chats">‹</button>
              <span className="ch-av">{cur.kind === 'group' ? '👥' : initial(roomName(cur))}</span>
              <b>{roomName(cur)}</b>
            </div>
            <div className="ch-msgs">
              {msgs.length === 0 && <p className="muted ch-none">No messages yet. Say hello 👋</p>}
              {msgs.map((m) => {
                const d = dayOf(m.created_at);
                const showDay = d !== lastDay; lastDay = d;
                return (
                  <div key={m.id}>
                    {showDay && <div className="ch-day"><span>{d}</span></div>}
                    <Bubble m={m} mine={m.user_id === user.id} who={nice(byId[m.user_id]?.name) || 'Someone'} showWho={cur.kind === 'group'} onDelete={del} />
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            {err && <div className="error" style={{ margin: '0 12px' }}>{err}</div>}
            {rec ? (
              <div className="ch-bar ch-recbar">
                <span className="ch-recdot" /> <b>Recording {Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, '0')}</b>
                <button type="button" className="btn ghost" onClick={() => stopRec(false)}>✕ Cancel</button>
                <button type="button" className="btn" onClick={() => stopRec(true)}>➤ Send</button>
              </div>
            ) : (
              <form className="ch-bar" onSubmit={sendText}>
                <span className="ch-photobtn">
                  <button type="button" className="ch-icon" title="Send a photo" onClick={() => setPhotoMenu((v) => !v)} disabled={busy}>📷</button>
                  {photoMenu && (
                    <span className="ch-photomenu">
                      <button type="button" onClick={() => { setPhotoMenu(false); setCam(true); }}>📸 Take photo (front or back camera)</button>
                      <button type="button" onClick={() => { setPhotoMenu(false); fileRef.current?.click(); }}>🖼 Choose from phone or computer</button>
                    </span>
                  )}
                </span>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPhoto} />
                <textarea rows={1} value={text} placeholder="Type a message" onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }} />
                {text.trim()
                  ? <button type="submit" className="ch-send" disabled={busy} aria-label="Send">➤</button>
                  : <button type="button" className="ch-send" disabled={busy} onClick={startRec} title="Record a voice note" aria-label="Record a voice note">🎤</button>}
              </form>
            )}
          </>
        )}
      </section>
      <CameraCapture open={cam} onClose={() => setCam(false)} onPhotos={(files) => sendPhotos(files)} />
    </div>
  );
}

export default function Page() {
  return <AuthGate entryPage wide><ChatPage /></AuthGate>;
}
