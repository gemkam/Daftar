'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/Modal';

/*
  ✍ Stamp and signature on invoices (Owner 11 Nov 2026, on every invoice of every company, Ali Pack too).
  Two places on the paper: Company stamp and Signature. Each one can be:
    ⬆ Upload  = a picture (photo or scan) of the stamp or of the signature
    ✍ Draw    = sign with the finger / mouse / pen on the screen
    ✕          = take it off
  value = { stamp, sign } (picture as data URL, saved with the invoice). onChange = null shows the pictures only.
  The buttons never print and are hidden in the PDF.
*/
const MAX = 700; // longest side of a saved picture, keeps the invoice small

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const png = /png|gif|webp/i.test(file.type);
      resolve(c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file is not a picture')); };
    img.src = url;
  });
}

/* only the drawn part, on a clear background */
function trimCanvas(src) {
  const ctx = src.getContext('2d');
  const { width: w, height: h } = src;
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return '';
  const pad = 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

function DrawPad({ title, onSave, onClose }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [ink, setInk] = useState('#1f2a6b');
  const [width, setWidth] = useState(3);
  const [used, setUsed] = useState(false);

  useEffect(() => {
    const c = ref.current;
    const ratio = window.devicePixelRatio || 1;
    const box = c.getBoundingClientRect();
    c.width = Math.round(box.width * ratio); c.height = Math.round(box.height * ratio);
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }, []);

  const at = (e) => { const b = ref.current.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  function down(e) {
    e.preventDefault();
    ref.current.setPointerCapture?.(e.pointerId);
    drawing.current = true; last.current = at(e);
    const ctx = ref.current.getContext('2d');
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(last.current.x, last.current.y, width / 2, 0, Math.PI * 2); ctx.fill();
    setUsed(true);
  }
  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const p = at(e);
    const ctx = ref.current.getContext('2d');
    ctx.strokeStyle = ink; ctx.lineWidth = e.pressure && e.pointerType === 'pen' ? width * (0.5 + e.pressure) : width;
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  }
  const up = () => { drawing.current = false; };
  function clear() {
    const c = ref.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setUsed(false);
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted" style={{ margin: '0 0 8px' }}>Sign inside the box with your finger, mouse or pen.</p>
      <canvas ref={ref} className="ss-pad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} />
      <div className="ss-pad-tools">
        <span>Ink</span>
        {['#1f2a6b', '#000000', '#0b57d0'].map((c) => (
          <button key={c} type="button" className={`ss-ink${ink === c ? ' on' : ''}`} style={{ background: c }} aria-label={`Ink ${c}`} onClick={() => setInk(c)} />
        ))}
        <span>Pen</span>
        <select value={width} onChange={(e) => setWidth(Number(e.target.value))}>
          <option value={2}>Thin</option><option value={3}>Normal</option><option value={5}>Thick</option>
        </select>
        <button type="button" className="btn small ghost" onClick={clear}>Clear</button>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn in" disabled={!used} onClick={() => { const url = trimCanvas(ref.current); if (url) onSave(url); }}>Use this signature</button>
      </div>
    </Modal>
  );
}

function Slot({ k, label, value, onChange, flash }) {
  const pick = useRef(null);
  const [pad, setPad] = useState(false);
  const pic = value?.[k] || '';
  const set = (v) => onChange?.({ ...(value || {}), [k]: v || null });
  async function upload(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { set(await fileToDataUrl(f)); } catch (err) { flash ? flash(err.message, 'err') : window.alert(err.message); }
  }
  if (!onChange && !pic) return null;
  return (
    <div className={`ss-slot ss-${k}${pic ? '' : ' is-empty'}`}>
      {pic ? <img src={pic} alt={label} className="ss-img" /> : <span className="ss-empty no-print">{label}</span>}
      {onChange && (
        <div className="ss-tools no-print">
          <input ref={pick} type="file" accept="image/*" hidden onChange={upload} />
          <button type="button" className="btn small ghost" onClick={() => pick.current?.click()} title={`Upload a picture of the ${label.toLowerCase()}`}>⬆ Upload</button>
          <button type="button" className="btn small ghost" onClick={() => setPad(true)} title="Sign on the screen">✍ Draw</button>
          {pic && <button type="button" className="btn small ghost danger-text" onClick={() => set(null)} aria-label={`Remove ${label}`}>✕</button>}
        </div>
      )}
      {pad && <DrawPad title={`✍ Draw: ${label}`} onClose={() => setPad(false)} onSave={(url) => { set(url); setPad(false); }} />}
    </div>
  );
}

export default function SignStamp({ value, onChange = null, flash, className = '' }) {
  return (
    <div className={`ss-row ${className}`}>
      <Slot k="stamp" label="Company stamp" value={value} onChange={onChange} flash={flash} />
      <Slot k="sign" label="Signature" value={value} onChange={onChange} flash={flash} />
    </div>
  );
}
