'use client';
// Opening animation (Daftar, 19 Nov 2026). Plays every time the MAIN page (/) is opened or refreshed, and again from
// the "▶ Intro" button on the Home page. Tap / click / any key skips it.
//
// Black stage:
//   0.0 s  a gold light line opens from the centre, soft glow and floating sparks behind
//   0.5 s  D A F T A R rises letter by letter (blur to sharp), then a gold shine runs across the word
//   2.9 s  "POWERED BY" fades in, then K S  T E C H  L L C flips in letter by letter with a teal glow
//   6.6 s  everything zooms softly and fades, the normal page comes forward
// The overlay is in the server HTML so the page never flashes before it; INTRO_BOOT
// (lib/intro.js, run in app/layout.js <head>) hides it at once on every page except the main page.
// All styles for this intro are inside this file (CSS below), so the old intro styles in globals.css do not apply.
import { useEffect, useRef, useState } from 'react';
import { INTRO_REPLAY } from '@/lib/intro';

const OUT_AT = 6600;  // start of the fade out
const OUT_MS = 900;   // length of the fade out

/* Sparks: fixed positions (no random numbers, so the server and the browser draw the same thing) */
const SPARKS = Array.from({ length: 34 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 100,
  size: 2 + (i % 3),
  delay: (i * 173) % 3000,
  dur: 4200 + ((i * 271) % 3000)
}));

function Letters({ text, start, step, className, charClass, shineAt }) {
  let i = 0;
  return (
    <span className={className} aria-hidden="true">
      {text.split('').map((ch, k) => {
        if (ch === ' ') return <span key={k} className="dx-gap" />;
        const d = start + step * i;
        i += 1;
        const delay = shineAt != null ? `${d}ms, ${shineAt + 70 * (i - 1)}ms` : `${d}ms`;
        return <span key={k} className={charClass} style={{ animationDelay: delay }}>{ch}</span>;
      })}
    </span>
  );
}

const CSS = `
html.intro-done .dx-intro { display: none !important; }
.dx-intro {
  position: fixed; inset: 0; z-index: 10000; overflow: hidden; cursor: pointer;
  display: grid; place-items: center; background: #000; color: #fff;
  font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-user-select: none; user-select: none;
}
.dx-intro.is-out { animation: dx-out ${OUT_MS}ms cubic-bezier(.7, 0, .84, 0) forwards; }
@keyframes dx-out { to { opacity: 0; transform: scale(1.08); filter: blur(6px); } }

/* background: slow glow, vignette, sparks */
.dx-glow {
  position: absolute; width: 140vmax; height: 140vmax; left: 50%; top: 50%; translate: -50% -50%;
  background: radial-gradient(circle, rgba(212, 166, 60, .16) 0%, rgba(13, 110, 110, .10) 28%, rgba(0, 0, 0, 0) 55%);
  opacity: 0; animation: dx-glow-in 1.6s ease .2s forwards, dx-breathe 5s ease-in-out 1.8s infinite;
}
@keyframes dx-glow-in { to { opacity: 1; } }
@keyframes dx-breathe { 50% { transform: scale(1.08); } }
.dx-vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, #000 100%); }
.dx-spark {
  position: absolute; border-radius: 50%; background: #f3d27a; box-shadow: 0 0 8px 2px rgba(243, 210, 122, .55);
  opacity: 0; animation-name: dx-float; animation-timing-function: ease-in-out; animation-iteration-count: infinite;
}
@keyframes dx-float {
  0% { opacity: 0; transform: translateY(20px) scale(.6); }
  30% { opacity: .9; }
  100% { opacity: 0; transform: translateY(-90px) scale(1); }
}

/* centre */
.dx-center { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 0 16px; }

.dx-line {
  height: 2px; width: min(72vw, 620px); margin-bottom: 22px;
  background: linear-gradient(90deg, rgba(243,210,122,0), #f3d27a 30%, #fff 50%, #f3d27a 70%, rgba(243,210,122,0));
  box-shadow: 0 0 18px rgba(243, 210, 122, .7);
  transform: scaleX(0); animation: dx-line-open .9s cubic-bezier(.2, .8, .2, 1) .1s forwards;
}
.dx-line.b { margin: 20px 0 0; animation-delay: 1.5s; }
@keyframes dx-line-open { to { transform: scaleX(1); } }

.dx-title {
  margin: 0; line-height: 1; font-weight: 800; font-size: clamp(56px, 15vw, 150px); letter-spacing: .14em; padding-left: .14em;
  position: relative;
}
.dx-ch {
  display: inline-block; opacity: 0;
  background: linear-gradient(110deg, #ffffff 0%, #ffffff 40%, #f3d27a 50%, #ffffff 60%, #ffffff 100%);
  background-size: 300% 100%; background-position: 100% 0;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  text-shadow: 0 0 30px rgba(255, 255, 255, .12);
  animation: dx-rise .9s cubic-bezier(.2, .9, .25, 1.15) forwards, dx-shine 1.4s ease 2.1s forwards;
}
@keyframes dx-rise {
  0% { opacity: 0; transform: translateY(60%) scale(.85); filter: blur(12px); }
  100% { opacity: 1; transform: none; filter: blur(0); }
}
@keyframes dx-shine { to { background-position: 0 0; } }

.dx-powered { margin-top: 34px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.dx-pw-small {
  font-size: clamp(11px, 2.6vw, 15px); font-weight: 600; letter-spacing: .55em; padding-left: .55em; color: #9aa7b2;
  opacity: 0; animation: dx-fade-up .8s ease 2.9s forwards;
}
@keyframes dx-fade-up { from { opacity: 0; transform: translateY(10px); letter-spacing: .9em; } to { opacity: 1; transform: none; } }
.dx-pw-name {
  font-size: clamp(22px, 6vw, 44px); font-weight: 800; letter-spacing: .22em; padding-left: .22em;
  perspective: 600px; display: inline-flex;
}
.dx-pw-ch {
  display: inline-block; opacity: 0; color: #fff; transform-origin: 50% 100%;
  text-shadow: 0 0 14px rgba(32, 201, 180, .85), 0 0 34px rgba(32, 201, 180, .45);
  animation: dx-flip .7s cubic-bezier(.2, .9, .3, 1.2) forwards;
}
@keyframes dx-flip {
  0% { opacity: 0; transform: rotateX(-95deg) translateY(10px); }
  100% { opacity: 1; transform: none; }
}
.dx-gap { display: inline-block; width: .5em; }

.dx-skip {
  position: absolute; bottom: 18px; right: 20px; font-size: 12px; letter-spacing: .1em; color: rgba(255,255,255,.35);
  opacity: 0; animation: dx-glow-in .6s ease 1s forwards;
}
@media (prefers-reduced-motion: reduce) {
  .dx-intro *, .dx-intro { animation-duration: .01ms !important; animation-delay: 0ms !important; }
}
@media print { .dx-intro { display: none !important; } }
`;

export default function IntroSplash() {
  const [state, setState] = useState('play'); // play | out | gone
  const [run, setRun] = useState(0);           // changes on replay so every CSS animation starts again
  const timers = useRef([]);
  const leaving = useRef(false);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    clear();
    const root = document.documentElement;
    setState('out');
    root.classList.remove('intro-playing');   // page underneath comes forward while the intro fades
    timers.current.push(setTimeout(() => {
      root.classList.add('intro-done');
      setState('gone');
    }, OUT_MS));
  };

  const schedule = () => { timers.current.push(setTimeout(leave, OUT_AT)); };

  const start = () => {
    clear();
    leaving.current = false;
    const root = document.documentElement;
    root.classList.remove('intro-done');
    root.classList.add('intro-playing');
    setRun((r) => r + 1);
    setState('play');
    schedule();
  };

  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains('intro-done')) setState('gone');
    else {
      root.classList.add('intro-playing');
      schedule();
    }
    const onKey = () => { if (!leaving.current && root.classList.contains('intro-playing')) leave(); };
    const onReplay = () => start();
    window.addEventListener('keydown', onKey);
    window.addEventListener(INTRO_REPLAY, onReplay);
    return () => {
      clear();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(INTRO_REPLAY, onReplay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'gone') return null;

  return (
    <div key={run} className={`dx-intro${state === 'out' ? ' is-out' : ''}`} role="presentation" onClick={leave}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <span className="dx-glow" aria-hidden="true" />
      {SPARKS.map((s, i) => (
        <span key={i} className="dx-spark" aria-hidden="true" style={{
          left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size,
          animationDelay: `${s.delay}ms`, animationDuration: `${s.dur}ms`
        }} />
      ))}
      <span className="dx-vignette" aria-hidden="true" />

      <div className="dx-center">
        <span className="dx-line" aria-hidden="true" />
        <h1 className="dx-title" aria-label="DAFTAR">
          <Letters text="DAFTAR" start={500} step={110} charClass="dx-ch" shineAt={2100} />
        </h1>
        <span className="dx-line b" aria-hidden="true" />

        <div className="dx-powered" aria-label="POWERED BY KS TECH LLC">
          <span className="dx-pw-small" aria-hidden="true">POWERED BY</span>
          <Letters text="KS TECH LLC" start={3500} step={85} className="dx-pw-name" charClass="dx-pw-ch" />
        </div>
      </div>

      <span className="dx-skip" aria-hidden="true">Tap to skip</span>
    </div>
  );
}

// Small button for the Home page that plays the opening animation again.
export function IntroReplayButton() {
  return (
    <button
      type="button"
      className="intro-replay no-print"
      onClick={() => window.dispatchEvent(new Event(INTRO_REPLAY))}
      title="Play the opening animation"
    >
      ▶ Intro
    </button>
  );
}
