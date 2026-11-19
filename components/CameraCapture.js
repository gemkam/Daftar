'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/*
  📷 Take photo (8 Nov 2026). Used by 📥 Import documents (components/DocImport.js).
  Opens the camera inside the app (back camera on phones, webcam on PC).
  Take as many photos as needed, each shows as a small picture with × to remove,
  then "✓ Use n photos" hands them over as JPEG files (same path as picked photos).
  If the browser blocks the camera (or no camera), it falls back to the phone's own camera app
  (input capture="environment"); on a PC without a camera it opens the file picker.
*/

export default function CameraCapture({ open, onClose, onPhotos }) {
  const video = useRef(null);
  const stream = useRef(null);
  const fallback = useRef(null);
  const [shots, setShots] = useState([]); // [{ url, file }]
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState('environment');
  const [flashOn, setFlashOn] = useState(false);

  const stop = () => {
    (stream.current?.getTracks() || []).forEach((t) => t.stop());
    stream.current = null;
    setReady(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    let dead = false;
    setErr('');
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setErr('no-api'); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (dead) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        setErr(e?.name === 'NotAllowedError' ? 'blocked' : 'no-camera');
      }
    })();
    return () => { dead = true; stop(); };
  }, [open, facing]);

  // clean the small pictures when closed
  useEffect(() => {
    if (open) return;
    setShots((s) => { s.forEach((x) => URL.revokeObjectURL(x.url)); return []; });
  }, [open]);

  if (!open) return null;

  function take() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    setFlashOn(true);
    setTimeout(() => setFlashOn(false), 180);
    c.toBlob((b) => {
      if (!b) return;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const file = new File([b], `camera-${stamp}-${Math.random().toString(36).slice(2, 5)}.jpg`, { type: 'image/jpeg' });
      setShots((s) => [...s, { url: URL.createObjectURL(file), file }]);
    }, 'image/jpeg', 0.92);
  }

  const remove = (i) => setShots((s) => { URL.revokeObjectURL(s[i].url); return s.filter((_, j) => j !== i); });

  const finish = () => {
    const files = shots.map((s) => s.file);
    stop();
    onPhotos(files);
    onClose();
  };

  const cancel = () => {
    if (shots.length && !window.confirm(`Throw away ${shots.length} photo${shots.length > 1 ? 's' : ''}?`)) return;
    stop();
    onClose();
  };

  const onFallback = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    stop();
    onPhotos(files);
    onClose();
  };

  const msg = err === 'blocked'
    ? 'The camera is blocked for this site. Allow the camera in the browser (🔒 next to the address), or use the phone camera below.'
    : err ? 'No camera found in the browser. Use the phone camera below, or choose a photo.' : '';

  return createPortal(
    <div className="modal-back cam-back" role="dialog" aria-modal="true" aria-label="Take photo">
      <div className="cam-box">
        <div className="cam-head">
          <b>📷 Take photo of the bill</b>
          <button type="button" className="cd-x" onClick={cancel} aria-label="Close">×</button>
        </div>

        <div className="cam-view">
          {!err && <video ref={video} playsInline muted autoPlay />}
          {!err && !ready && <p className="cam-msg">Opening camera...</p>}
          {err && <p className="cam-msg err">{msg}</p>}
          {flashOn && <div className="cam-flash" />}
          {!err && <div className="cam-frame" aria-hidden="true" />}
        </div>

        {shots.length > 0 && (
          <div className="cam-shots">
            {shots.map((s, i) => (
              <div key={s.url} className="cam-shot">
                <img src={s.url} alt={`Photo ${i + 1}`} />
                <button type="button" onClick={() => remove(i)} aria-label="Remove photo">×</button>
                <small>{i + 1}</small>
              </div>
            ))}
          </div>
        )}

        <div className="cam-foot">
          {!err ? (
            <>
              <button type="button" className="btn ghost" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}>🔄 Switch camera</button>
              <button type="button" className="cam-shutter" onClick={take} disabled={!ready} aria-label="Take photo"><span /></button>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => fallback.current?.click()}>📷 Open phone camera</button>
          )}
          <button type="button" className="btn" onClick={finish} disabled={!shots.length}>✓ Use {shots.length || ''} photo{shots.length === 1 ? '' : 's'}</button>
        </div>
        <p className="cam-tip muted">Keep the whole bill inside the box, flat and in good light. Take one photo per bill.</p>
        <input ref={fallback} type="file" accept="image/*" capture="environment" hidden onChange={onFallback} />
      </div>
    </div>,
    document.body
  );
}
