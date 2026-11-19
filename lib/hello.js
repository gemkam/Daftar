/* Time of day hello for the assistant (Muscat time): morning before 12, afternoon 12 to 5 pm, evening after 5 pm. */
export function muscatHour() {
  return Number(new Date().toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Muscat' }));
}
export function timeHello(lang, h = muscatHour()) {
  const t = h < 12 ? 0 : h < 17 ? 1 : 2;
  return {
    en: ['Good morning', 'Good afternoon', 'Good evening'],
    ar: ['صباح الخير', 'مساء الخير', 'مساء الخير'],
    ur: ['صبح بخیر', 'السلام علیکم', 'شام بخیر'],
    ru: ['Subah bakhair', 'Assalam o Alaikum', 'Shaam bakhair']
  }[lang]?.[t] || ['Good morning', 'Good afternoon', 'Good evening'][t];
}
