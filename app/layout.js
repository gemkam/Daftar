import './globals.css';
import { THEME_BOOT } from '@/lib/theme';
import IntroSplash from '@/components/IntroSplash';
import { INTRO_BOOT } from '@/lib/intro';
import { UI_LANG_BOOT } from '@/lib/uiLang';
import UiTranslator from '@/components/UiTranslator';

const FONTS = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Work+Sans:wght@400;500;600&display=swap';

export const metadata = {
  metadataBase: new URL('https://daftar-gemkam.vercel.app'),
  title: 'Daftar Office System',
  description: 'All-in-one office system for Oman: Fawtara-ready invoices with VAT, quotations, customers (CRM), bills and approvals, expenses and petty cash, bank and cash accounts, profit and loss, employees, attendance and leave, salary slips, inventory, transport and fleet, documents with expiry alerts, multi-company, English and Arabic, with an AI assistant. Create a free account and try it.',
  openGraph: {
    title: 'Daftar Office System',
    description: 'All-in-one office system for Oman: Fawtara-ready invoices with VAT, quotations, customers (CRM), bills and approvals, expenses and petty cash, bank and cash accounts, profit and loss, employees, attendance and leave, salary slips, inventory, transport and fleet, documents with expiry alerts, multi-company, English and Arabic, with an AI assistant. Create a free account and try it.',
    siteName: 'Daftar Office System',
    type: 'website'
  },
  twitter: { card: 'summary_large_image', title: 'Daftar Office System' }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#13836b" />
        {/* Daftar has its own English / Arabic switch: stop Chrome "Translate this page" from translating it back */}
        <meta name="google" content="notranslate" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/* Opening animation: hide it at once if it already played in this tab (components/IntroSplash.js) */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_BOOT }} />
        {/* App language: Arabic turns the page right-to-left before it paints (lib/uiLang.js) */}
        <script dangerouslySetInnerHTML={{ __html: UI_LANG_BOOT }} />
        {/* Phone with Chrome "Desktop site" switched on: the page is laid out 980px wide and looks tiny.
            Scale it up to the phone's real width so text stays readable (31 Oct 2026).
            1 Nov 2026: also caught when Chrome reports the desktop width as the screen width (page shown shrunk). */}
        {/* Android / iPhone / iPad: html.mobile-os (Alerts button in the top bar, no floating alarm clock), 19 Nov 2026 */}
        <script dangerouslySetInnerHTML={{ __html: "(function(){try{var u=navigator.userAgent||'';if(/Android|iPhone|iPad|iPod/i.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1))document.documentElement.classList.add('mobile-os');}catch(e){}})();" }} />
        <script dangerouslySetInnerHTML={{ __html: "(function(){try{var d=document.documentElement;var coarse=window.matchMedia&&matchMedia('(pointer: coarse)').matches&&!matchMedia('(any-pointer: fine)').matches;var f=function(){var sw=screen.width;var w=window.innerWidth;var vv=window.visualViewport;var shrunk=vv&&vv.scale<0.8&&w>=900;if(coarse&&((sw&&sw<820&&w>sw*1.4)||shrunk)){d.style.zoom=((sw&&sw<820&&w>sw*1.4)?w/sw:1/vv.scale).toFixed(3);d.classList.add('desk-on-phone');}else{d.style.zoom='';d.classList.remove('desk-on-phone');}};f();window.addEventListener('resize',f);}catch(e){}})();" }} />
        {/* Speed (31 Oct 2026): open the database connection early, and load the Google fonts WITHOUT holding up the page
            (the page shows at once in the normal font, the nice font swaps in when it arrives). */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preload" as="style" href={FONTS} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='${FONTS}';document.head.appendChild(l);})();` }} />
        <noscript><link rel="stylesheet" href={FONTS} /></noscript>
      </head>
      <body>
        <div className="watermark" aria-hidden="true" />
        <div className="content">{children}</div>
        <IntroSplash />
        <UiTranslator />
      </body>
    </html>
  );
}
