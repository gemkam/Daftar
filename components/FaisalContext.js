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

/* Greeting used on pages that do not give their own (time of day in Muscat, "from Daftar app") */
export function defaultGreeting(name) {
  const who = name ? ` ${name}` : '';
  return {
    en: `${timeHello('en')}${who}! I am Faisal from Daftar app, your assistant for alerts, payments to make and collect, transport, office expenses, invoices and inventory. How can I help you? Please go ahead, I am listening.`,
    ru: `${timeHello('ru')}${who}! Main Daftar app se Faisal hoon, aap ka assistant: alerts, payments, transport, office kharcha, invoices aur inventory. Main aap ki kya madad kar sakta hoon? Boliye, main sun raha hoon.`,
    ur: `${timeHello('ur')}${who}! میں دفتر ایپ سے فیصل ہوں، آپ کا اسسٹنٹ: الرٹس، ادائیگیاں، ٹرانسپورٹ، دفتر کا خرچہ، انوائسز اور انوینٹری۔ میں آپ کی کیا مدد کر سکتا ہوں؟ بولیے، میں سن رہا ہوں۔`,
    ar: `${timeHello('ar')}${who}! أنا فيصل من برنامج دفتر، مساعدك في التنبيهات، الفلوس اللي عليك واللي لك، النقل، مصاريف المكتب، الفواتير والمخزون. شو أقدر أسوي لك؟ تفضّل، أنا أسمعك.`
  };
}
