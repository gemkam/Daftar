'use client';

import { createContext, useContext, useEffect } from 'react';

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

/* Greeting used on pages that do not give their own */
export function defaultGreeting(name) {
  const h = Number(new Date().toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Muscat' }));
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const who = name ? ` ${name}` : '';
  return {
    en: `${part}${who}! I am Faisal, your assistant for the whole Daftar Office System: alerts, payments to make and collect, transport, office expenses, invoices and inventory. How can I help you? Please go ahead, I am listening.`,
    ru: `Assalam o Alaikum${who}! Main Faisal hoon, poore Daftar Office System ka assistant: alerts, payments, transport, office kharcha, invoices aur inventory. Main aap ki kya madad kar sakta hoon? Boliye, main sun raha hoon.`
  };
}
