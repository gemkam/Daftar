/*
  App language (Daftar, 19 Nov 2026, Owner): English or Arabic (Omani dialect) for the whole app.
  Chosen with the button next to the colours in the top bar (and on the login page). Saved on this device
  (localStorage "daftar-ui-lang"). Arabic = every screen word is swapped from public/i18n-ar.json by
  components/UiTranslator.js, and the page turns right-to-left. Data typed by users (names, notes) stays as typed.
*/
export const UI_LANG_KEY = 'daftar-ui-lang';

export function getUiLang() {
  try { return localStorage.getItem(UI_LANG_KEY) === 'ar' ? 'ar' : 'en'; } catch { return 'en'; }
}

/* switch and reload, so every page part starts clean in the new language */
export function setUiLang(lang) {
  try { localStorage.setItem(UI_LANG_KEY, lang === 'ar' ? 'ar' : 'en'); } catch { /* ignore */ }
  window.location.reload();
}

/* runs in <head> before the page paints: right-to-left at once, and hide the page until the words are swapped */
export const UI_LANG_BOOT = `(function(){try{if(localStorage.getItem('${UI_LANG_KEY}')==='ar'){var d=document.documentElement;d.setAttribute('dir','rtl');d.setAttribute('lang','ar');d.classList.add('ui-ar','tr-wait');setTimeout(function(){d.classList.remove('tr-wait');},3500);}}catch(e){}})();`;
