'use client';
/* Language button (Daftar): English ⇄ العربية for the whole app. Next to the colours in the top bar and on the login page. */
import { useEffect, useState } from 'react';
import { getUiLang, setUiLang } from '@/lib/uiLang';

export default function LangSwitch({ className = '' }) {
  const [lang, setLang] = useState('en');
  useEffect(() => { setLang(getUiLang()); }, []);
  const ar = lang === 'ar';
  return (
    <button
      type="button"
      data-no-tr
      className={`lang-switch ${className}`}
      onClick={() => setUiLang(ar ? 'en' : 'ar')}
      title={ar ? 'English' : 'العربية'}
      aria-label={ar ? 'Switch to English' : 'التحويل إلى العربية'}
    >
      {ar ? 'EN' : 'ع'}
    </button>
  );
}
