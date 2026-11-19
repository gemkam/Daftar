/*
  ⚡ Power switch (Owner 11 Nov 2026): Admin › Power Editor is one ON / OFF switch (Administrator only, edit password to
  turn it on). While it is ON, tapping a word, label or photo anywhere in the app opens a small box to rename it, change its
  font, size, colour, or change the photo / logo; Save keeps it for every user at once (app_settings "look").
  Data is NOT changed here (tables, boxes and forms keep their own ✏️ Edit). OFF = nothing can be changed.
  Kept in sessionStorage: stays ON while moving between pages, OFF when the browser tab is closed.
*/
const KEY = 'tudo-power';

export function isPowerOn() {
  try { return typeof window !== 'undefined' && sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setPower(on) {
  try { if (on) sessionStorage.setItem(KEY, '1'); else sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tudo-power', { detail: !!on }));
}

/* ↶ Undo steps (whole look before each save), kept while the tab is open */
export const powerUndo = [];

/* 👆 Open mode (Owner 11 Nov 2026): switch stays ON but taps open pages / buttons normally, so he can go inside
   (e.g. Lead Staff › Chairman) and then go back to ✏️ Change mode. Kept in sessionStorage too. */
const BROWSE = 'tudo-power-browse';
export function isBrowse() {
  try { return typeof window !== 'undefined' && sessionStorage.getItem(BROWSE) === '1'; } catch { return false; }
}
export function setBrowse(on) {
  try { if (on) sessionStorage.setItem(BROWSE, '1'); else sessionStorage.removeItem(BROWSE); } catch { /* ignore */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tudo-power-browse', { detail: !!on }));
}
