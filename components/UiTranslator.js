'use client';
/*
  Whole-app Arabic (Daftar, 19 Nov 2026). When the app language is Arabic (lib/uiLang.js), every text on screen
  that is an app word (button, heading, label, message, placeholder, tooltip) is swapped for its Arabic from
  public/i18n-ar.json. Numbers inside a sentence are kept (the "#" in the word list). Anything typed by users
  (names, notes, amounts) is not in the list, so it stays as typed. Parts marked data-no-tr are skipped.
  New text that React puts on the page later is swapped too (MutationObserver).
*/
import { useEffect } from 'react';
import { getUiLang } from '@/lib/uiLang';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'SELECT_VALUE']);
const ATTRS = ['placeholder', 'title', 'aria-label'];
const HAS_LETTER = /[A-Za-z]/;

function makeTranslate(dict) {
  return (s) => {
    if (!s || !HAS_LETTER.test(s)) return null;
    const lead = s.match(/^[^\p{L}]*/u)[0];
    const rest = s.slice(lead.length);
    const trail = rest.match(/[^\p{L}.!?)]*$/u)[0];
    const mid = rest.slice(0, rest.length - trail.length);
    const nums = [];
    const key = mid.replace(/\s+/g, ' ').trim().replace(/\d+([.,]\d+)*/g, (m) => { nums.push(m); return '#'; });
    let t = dict[key];
    if (t == null) {
      // "Bills:" or "Bills ›" style: try without a last dot / bracket
      const k2 = key.replace(/[.!?)]+$/, '');
      if (k2 !== key) t = dict[k2] != null ? dict[k2] + key.slice(k2.length) : null;
    }
    if (t == null) return null;
    let i = 0;
    t = t.replace(/#/g, () => (nums[i] != null ? nums[i++] : ''));
    return lead + t + trail;
  };
}

export default function UiTranslator() {
  useEffect(() => {
    if (getUiLang() !== 'ar') return undefined;
    const root = document.documentElement;
    let obs = null;
    let stop = false;
    const done = new WeakMap(); // text node -> what we wrote, so our own change is not done again

    // Arabic font
    if (!document.getElementById('ar-font')) {
      const l = document.createElement('link');
      l.id = 'ar-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap';
      document.head.appendChild(l);
    }

    fetch('/i18n-ar.json', { cache: 'force-cache' }).then((r) => r.json()).then((dict) => {
      if (stop) return;
      const tr = makeTranslate(dict);
      const skip = (el) => {
        for (let e = el; e && e !== document.body; e = e.parentElement) {
          if (SKIP_TAGS.has(e.tagName) || e.isContentEditable || e.hasAttribute?.('data-no-tr') || e.classList?.contains('notranslate')) return true;
        }
        return false;
      };
      const doText = (n) => {
        if (done.get(n) === n.data) return;
        if (!n.parentElement || skip(n.parentElement)) return;
        const out = tr(n.data);
        if (out != null && out !== n.data) { n.data = out; done.set(n, out); }
      };
      const doAttrs = (el) => {
        if (!el.getAttribute) return;
        for (const a of ATTRS) {
          const v = el.getAttribute(a);
          const mark = `data-tr-${a}`;
          if (!v || el.getAttribute(mark) === v) continue;
          const out = tr(v);
          if (out != null && out !== v) { el.setAttribute(mark, out); el.setAttribute(a, out); }
        }
      };
      const walk = (node) => {
        if (node.nodeType === 3) { doText(node); return; }
        if (node.nodeType !== 1 || skip(node)) return;
        doAttrs(node);
        const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        let x = w.nextNode();
        while (x) {
          if (x.nodeType === 3) doText(x); else doAttrs(x);
          x = w.nextNode();
        }
      };
      const titleOf = () => { const o = tr(document.title); if (o) document.title = o; };

      walk(document.body);
      titleOf();
      root.classList.remove('tr-wait');

      let queue = new Set();
      let raf = 0;
      const flush = () => { raf = 0; const q = queue; queue = new Set(); q.forEach((n) => { if (n.isConnected) walk(n); }); titleOf(); };
      obs = new MutationObserver((list) => {
        for (const m of list) {
          if (m.type === 'characterData') queue.add(m.target);
          else if (m.type === 'attributes') queue.add(m.target);
          else m.addedNodes.forEach((n) => queue.add(n));
        }
        if (!raf) raf = requestAnimationFrame(flush);
      });
      obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }).catch(() => root.classList.remove('tr-wait'));

    return () => { stop = true; obs?.disconnect(); };
  }, []);
  return null;
}
