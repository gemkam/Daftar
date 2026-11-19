'use client';

import { useEffect, useState } from 'react';
import AuthGate, { useUser } from '@/components/AuthGate';
import { requestEditPassword, lockEdit } from '@/lib/editLock';
import { isPowerOn, setPower, setBrowse } from '@/lib/power';

/*
  🛠 Power Editor = one ⚡ ON / OFF switch (Owner 11 Nov 2026; replaces the Data / Styles / Layout / Texts lists, which
  confused). Administrator only. Turning it ON asks the edit password. While ON, tap any word, label or photo anywhere in
  the app to rename it, change its font / size / colour, or change the photo / logo (components/PowerMode.js), saved for
  everyone. Data is not changed by the switch: it has its own ✏️ Edit on each page. OFF = nothing can be changed.
  Changes saved earlier with the old Styles / Layout / Texts lists still show (app_settings "look").
*/

function PowerSwitch() {
  const { isOwner } = useUser();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isPowerOn());
    const f = (e) => setOn(!!e.detail);
    window.addEventListener('tudo-power', f);
    return () => window.removeEventListener('tudo-power', f);
  }, []);

  if (!isOwner) return <p>Administrator only.</p>;

  async function flip() {
    if (on) { setPower(false); return; }
    const yes = await requestEditPassword();
    lockEdit(); // the password is only for the switch; data editing stays locked
    if (yes) { setBrowse(false); setPower(true); }
  }

  return (
    <>
      <div className="company-head ch-top">
        <span className="company-name">Admin · Administrator only</span>
        <h1>🛠 Power Editor</h1>
        <p className="sub">Turn the switch on, then change any label, font or photo in the app itself. Turn it off and nothing can be changed.</p>
      </div>

      <div className={`pw-ui pw-switchcard${on ? ' on' : ''}`}>
        <button type="button" role="switch" aria-checked={on} className={`pw-switch${on ? ' on' : ''}`} onClick={flip} aria-label="Power editing">
          <span className="pw-knob" />
        </button>
        <div className="pw-state">
          <b>{on ? '⚡ ON: you can change the app' : 'OFF: nothing can be changed'}</b>
          <span className="muted">{on ? 'Go to any page and tap a word, label or photo.' : 'Tap the switch to turn it on.'}</span>
        </div>
      </div>

      <div className="pw-how">
        <h2>How it works</h2>
        <ul>
          <li><b>Rename:</b> tap a label (for example General Manager or Secretaries), type the new words, 💾 Save.</li>
          <li><b>Font:</b> in the same box choose a font, size, colour, bold or italic. It changes only that item.</li>
          <li><b>Photo or logo:</b> tap the photo, 📷 Choose new photo, 💾 Save.</li>
          <li><b>Where:</b> Only on this page, or Everywhere in the app.</li>
          <li><b>↩ Back to original</b> in the box, or <b>↶ Undo</b> in the green bar at the bottom.</li>
          <li><b>Go inside a page</b> (for example Lead Staff › General Manager): tap <b>👆 Open pages</b> in the green bar, open the page, then tap <b>✏️ Change</b> to change things there. Or use ▶ Open it in the box.</li>
          <li>Saved changes show for every user at once.</li>
          <li>Data (table rows, amounts, forms) is not changed here. Each page has its own ✏️ Edit for data.</li>
        </ul>
      </div>
    </>
  );
}

export default function Page() {
  return <AuthGate ownerOnly><PowerSwitch /></AuthGate>;
}
