// Opening animation boot script. Runs in <head> before the page paints.
// Daftar (19 Nov 2026, Owner): the intro plays ONCE when the app is opened (first time in this browser tab, on the
// main page /). Refreshing, switching the language or coming back to Home does not play it again.
// It plays again only from the "▶ Intro" button on the Home page, or in a new tab / after the browser is closed.
// 24 Nov 2026: it also always plays when the app is opened from another site (e.g. a link on Black Diamond or
// WhatsApp) or with ?intro in the address, even if this tab already saw it.
// Used by app/layout.js, the animation is components/IntroSplash.js.
export const INTRO_REPLAY = 'tudo-intro-replay'; // window event the "▶ Intro" button sends to play it again
export const INTRO_SEEN = 'daftar-intro-seen';  // sessionStorage: set when the intro starts
export const INTRO_BOOT = `(function(){var d=document.documentElement;try{var seen=sessionStorage.getItem('${INTRO_SEEN}')==='1';var fromOutside=false;try{fromOutside=/[?&]intro\\b/.test(location.search)||(!!document.referrer&&new URL(document.referrer).origin!==location.origin);}catch(e){}if(fromOutside)seen=false;if(location.pathname==='/'&&!seen){sessionStorage.setItem('${INTRO_SEEN}','1');d.classList.add('intro-playing');}else{d.classList.add('intro-done');}}catch(e){d.classList.add('intro-done');}})();`;
