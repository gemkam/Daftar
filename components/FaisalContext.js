'use client';

import { createContext, useContext, useEffect } from 'react';
import { timeHello } from '@/lib/hello';

/*
  Faisal (the AI assistant) lives in AuthGate, so he is on every page.
  A page can hand him extra text about what is on screen (Reports & Summary does) with useFaisalPage().
*/
export const FaisalCtx = createContext({ setPageAi: () => {} });

export function useFaisalPage({ context = '', greeting = null, alertCount = 0 } = {}) {
  const { setPageAi } = useContext(FaisalCtx);
  useEffect(() => {
    setPageAi(context || greeting ? { context, greeting, alertCount } : null);
  }, [setPageAi, context, greeting, alertCount]);
  useEffect(() => () => setPageAi(null), [setPageAi]);
}

/* Greeting used on pages that do not give their own: time of day in Muscat, no assistant or app name (Owner, 19 Nov 2026) */
export function defaultGreeting(name) {
  const n = /^admin$/i.test(name || '') ? 'Administrator' : name || 'Administrator';
  const who = ` ${n}`;
  const whoAr = /^admin$/i.test(name || '') || !name ? '' : ` ${name}`;
  return {
    en: `${timeHello('en')}${who}! How may I help you?`,
    ru: 'Assalam o Alaikum! Kaise hain aap? Main aap ki kya madad kar sakta hoon?',
    ur: 'السلام علیکم! کیسے ہیں آپ؟ میں آپ کی کیا مدد کر سکتا ہوں؟',
    ar: 'السلام عليكم يا سيدي! كيف حالك؟ شو أقدر أسوي لك؟'
  };
}
