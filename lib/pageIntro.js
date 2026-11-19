/*
  🗣 Page intro (19 Nov 2026, Kamran: "Whenever the page changes, the AI assistant will talk according to the page").
  One short line per page in the 4 assistant languages: what this page is and what to ask.
  components/NoorAssistant.js shows it (and says it, when the voice is on) when the page changes.
  No AI call, so it costs nothing and works when the free AI limit is used up.
  Each entry: [path test, { en, ru, ur, ar }]. First match wins.
*/
const PAGES = [
  [(p) => p === '/', {
    en: 'This is Home. Your companies and their buttons are here. Ask me about bills, salaries or anything that needs attention.',
    ru: 'Yeh Home hai. Yahan aap ki companies aur un ke buttons hain. Mujh se bills, salary ya pending kaam ke baare mein poochein.',
    ur: 'یہ ہوم ہے۔ یہاں آپ کی کمپنیاں اور ان کے بٹن ہیں۔ مجھ سے بل، تنخواہ یا زیرِ التوا کام کے بارے میں پوچھیں۔',
    ar: 'هذي الصفحة الرئيسية. هنا شركاتك وأزرارها. اسألني عن الفواتير أو الرواتب أو أي شي يبغى انتباه.'
  }],
  [(p) => p === '/add-company', {
    en: 'Here you add your company. Fill the owner details and the company details. Owner name, ID card number, company name and CR number are needed. Then tap Save and open my company.',
    ru: 'Yahan aap apni company add karte hain. Owner aur company ki details bharein. Owner ka naam, ID card number, company ka naam aur CR number zaroori hain. Phir Save and open my company dabayein.',
    ur: 'یہاں آپ اپنی کمپنی شامل کرتے ہیں۔ مالک اور کمپنی کی تفصیل بھریں۔ مالک کا نام، شناختی کارڈ نمبر، کمپنی کا نام اور سی آر نمبر ضروری ہیں۔ پھر Save and open my company دبائیں۔',
    ar: 'هنا تضيف شركتك. عبّي بيانات المالك وبيانات الشركة. اسم المالك ورقم البطاقة واسم الشركة ورقم السجل التجاري لازم. بعدين اضغط احفظ وافتح شركتي.'
  }],
  [(p) => p === '/team', {
    en: 'This is Users. Tap New user to make a login for your staff, choose the designation, what he can do and which companies he can open.',
    ru: 'Yeh Users page hai. New user daba kar apne staff ka login banayein, designation, access aur companies chunein.',
    ur: 'یہ یوزرز کا صفحہ ہے۔ New user دبا کر اپنے عملے کا لاگ اِن بنائیں، عہدہ، اختیار اور کمپنیاں چنیں۔',
    ar: 'هذي صفحة المستخدمين. اضغط مستخدم جديد عشان تسوي حساب لموظف، واختار المسمى وشو يقدر يسوي والشركات اللي يفتحها.'
  }],
  [(p) => p.startsWith('/company/'), {
    en: 'This is your company page. Every part of the company is here: bills, invoices, salary, employees, accounts, reports and inventory. Tap a button to open it.',
    ru: 'Yeh aap ki company ka page hai. Bills, invoices, salary, employees, accounts, reports aur inventory sab yahan hain. Koi bhi button dabayein.',
    ur: 'یہ آپ کی کمپنی کا صفحہ ہے۔ بل، انوائس، تنخواہ، ملازمین، اکاؤنٹس، رپورٹس اور انوینٹری سب یہاں ہیں۔ کوئی بھی بٹن دبائیں۔',
    ar: 'هذي صفحة شركتك. كل شي هنا: الفواتير والمبيعات والرواتب والموظفين والحسابات والتقارير والمخزون. اضغط أي زر عشان تفتحه.'
  }],
  [(p) => p === '/expenses/docs', {
    en: 'Here are the bills and invoices. Add a bill, import photos or PDFs, and the AI reads them. Ask me which bills are unpaid or the total of a month.',
    ru: 'Yahan bills aur invoices hain. Bill add karein ya photo ya PDF import karein, AI khud parh leta hai. Mujh se unpaid bills ya mahine ka total poochein.',
    ur: 'یہاں بل اور انوائس ہیں۔ بل شامل کریں یا تصویر یا پی ڈی ایف امپورٹ کریں، اے آئی خود پڑھ لیتا ہے۔ مجھ سے غیر ادا شدہ بل یا مہینے کا کل پوچھیں۔',
    ar: 'هنا الفواتير والمبيعات. أضف فاتورة أو حمّل صور أو PDF والذكاء الاصطناعي يقراها. اسألني عن الفواتير اللي ما انصرفت أو مجموع الشهر.'
  }],
  [(p) => p === '/expenses/petty', {
    en: 'This is Petty cash: cash received and spent, with the balance by month.',
    ru: 'Yeh Petty cash hai: aaya hua aur kharch hua cash, aur har mahine ka balance.',
    ur: 'یہ پیٹی کیش ہے: آیا ہوا اور خرچ ہوا کیش، اور ہر مہینے کا بیلنس۔',
    ar: 'هذي العهدة النقدية: الكاش الداخل والمصروف والرصيد حسب الشهر.'
  }],
  [(p) => p === '/expenses/salary' || p.startsWith('/transport/salary'), {
    en: 'This is Salary. Make the monthly salary slips, approve them and mark them paid. Ask me the salary total of a month.',
    ru: 'Yeh Salary page hai. Har mahine ki salary slips banayein, approve karein aur paid karein. Mujh se mahine ki total salary poochein.',
    ur: 'یہ تنخواہ کا صفحہ ہے۔ ماہانہ سیلری سلپ بنائیں، منظور کریں اور ادا شدہ کریں۔ مجھ سے مہینے کی کل تنخواہ پوچھیں۔',
    ar: 'هذي صفحة الرواتب. سوّ قسائم الراتب الشهرية ووافق عليها وعلّمها مدفوعة. اسألني عن مجموع رواتب الشهر.'
  }],
  [(p) => p === '/expenses/vat', {
    en: 'This is the VAT return: output VAT on sales and input VAT on bills, by quarter or month.',
    ru: 'Yeh VAT return hai: sales ka output VAT aur bills ka input VAT, quarter ya mahine ke hisaab se.',
    ur: 'یہ وی اے ٹی ریٹرن ہے: سیلز کا آؤٹ پٹ وی اے ٹی اور بلوں کا ان پٹ وی اے ٹی، سہ ماہی یا مہینے کے حساب سے۔',
    ar: 'هذا الإقرار الضريبي: ضريبة المبيعات وضريبة المشتريات حسب الربع أو الشهر.'
  }],
  [(p) => p.startsWith('/expenses/summary'), {
    en: 'This is Reports and Summary: budgets, cash flow, profit and loss and month by month. Ask me which head grew the most or the profit of a month.',
    ru: 'Yeh Reports and Summary hai: budget, cash flow, profit and loss aur har mahine ka hisaab. Mujh se poochein kis head mein kharcha sab se zyada barha.',
    ur: 'یہ رپورٹس اور خلاصہ ہے: بجٹ، کیش فلو، نفع نقصان اور ماہانہ حساب۔ مجھ سے پوچھیں کس مد میں خرچ سب سے زیادہ بڑھا۔',
    ar: 'هذي التقارير والملخص: الميزانيات والتدفق النقدي والأرباح والخسائر شهر بشهر. اسألني أي بند زاد أكثر أو ربح الشهر.'
  }],
  [(p) => p === '/expenses', {
    en: 'This is the Expense sheet: every bill and expense of the company by department. You can print or export to Excel or PDF.',
    ru: 'Yeh Expense sheet hai: company ke saare bills aur kharche department ke hisaab se. Print, Excel ya PDF bhi kar sakte hain.',
    ur: 'یہ ایکسپینس شیٹ ہے: کمپنی کے تمام بل اور خرچے شعبے کے حساب سے۔ پرنٹ، ایکسل یا پی ڈی ایف بھی کر سکتے ہیں۔',
    ar: 'هذا كشف المصاريف: كل فواتير ومصاريف الشركة حسب القسم. تقدر تطبع أو تصدّر إكسل أو PDF.'
  }],
  [(p) => p === '/personnel', {
    en: 'This is Employees: office and site staff, their papers, and the attendance sheet. Ask me whose papers expire soon.',
    ru: 'Yeh Employees page hai: office aur site staff, un ke papers aur attendance. Mujh se poochein kis ke papers jald expire ho rahe hain.',
    ur: 'یہ ملازمین کا صفحہ ہے: دفتر اور سائٹ کا عملہ، ان کے کاغذات اور حاضری۔ مجھ سے پوچھیں کس کے کاغذات جلد ختم ہو رہے ہیں۔',
    ar: 'هذي صفحة الموظفين: موظفين المكتب والموقع وأوراقهم وكشف الحضور. اسألني منو أوراقه بتنتهي قريب.'
  }],
  [(p) => p === '/accounts', {
    en: 'This is Accounts: bank and cash, the balance sheet, money to receive and money to pay.',
    ru: 'Yeh Accounts hai: bank aur cash, balance sheet, lene aur dene wale paise.',
    ur: 'یہ اکاؤنٹس ہے: بینک اور کیش، بیلنس شیٹ، لینے اور دینے والی رقم۔',
    ar: 'هذي الحسابات: البنك والكاش والميزانية العمومية والفلوس اللي لك واللي عليك.'
  }],
  [(p) => p === '/inventory' || p.startsWith('/c/') || p === '/log' || p === '/bills' || p.startsWith('/inventory/'), {
    en: 'This is Inventory: sections, items, stock in and out, and supplier bills. Ask me which items are low.',
    ru: 'Yeh Inventory hai: sections, items, stock ka aana jana aur bills. Mujh se poochein kaun se items kam hain.',
    ur: 'یہ انوینٹری ہے: سیکشن، اشیاء، اسٹاک کی آمد و رفت اور بل۔ مجھ سے پوچھیں کون سی اشیاء کم ہیں۔',
    ar: 'هذا المخزون: الأقسام والأصناف والداخل والطالع وفواتير الموردين. اسألني أي أصناف قاربت تخلص.'
  }],
  [(p) => p.startsWith('/transport') || p === '/entry', {
    en: 'This is Transport: trips, drivers, vehicles, diesel and salary sheets. Ask me the trips or profit of a driver this month.',
    ru: 'Yeh Transport hai: trips, drivers, gaariyan, diesel aur salary sheets. Mujh se kisi driver ke is mahine ke trips ya profit poochein.',
    ur: 'یہ ٹرانسپورٹ ہے: ٹرپس، ڈرائیور، گاڑیاں، ڈیزل اور سیلری شیٹس۔ مجھ سے کسی ڈرائیور کے اس مہینے کے ٹرپس یا منافع پوچھیں۔',
    ar: 'هذا النقل: الرحلات والسواقين والمركبات والديزل وكشوف الرواتب. اسألني عن رحلات أو ربح سايق هالشهر.'
  }],
  [(p) => p === '/chat', {
    en: 'This is Chat. Send messages to the people of your company.',
    ru: 'Yeh Chat hai. Apni company ke logon ko message bhejein.',
    ur: 'یہ چیٹ ہے۔ اپنی کمپنی کے لوگوں کو پیغام بھیجیں۔',
    ar: 'هذي المحادثة. أرسل رسايل لناس شركتك.'
  }],
  [(p) => p === '/alerts', {
    en: 'These are the Alerts: what is due, overdue or needs attention. Ask me what to do first.',
    ru: 'Yeh Alerts hain: jo kaam due ya overdue hai. Mujh se poochein pehle kya karna hai.',
    ur: 'یہ الرٹس ہیں: جو کام واجب یا تاخیر میں ہیں۔ مجھ سے پوچھیں پہلے کیا کرنا ہے۔',
    ar: 'هذي التنبيهات: اللي مستحق أو متأخر أو يبغى انتباه. اسألني شو أسوي أول.'
  }],
  [(p) => p === '/docs', {
    en: 'This is the Documents Checklist: company and staff papers with their expiry dates.',
    ru: 'Yeh Documents Checklist hai: company aur staff ke papers aur un ki expiry dates.',
    ur: 'یہ ڈاکیومنٹس چیک لسٹ ہے: کمپنی اور عملے کے کاغذات اور ان کی میعاد۔',
    ar: 'هذي قائمة الأوراق: أوراق الشركة والموظفين وتواريخ انتهائها.'
  }],
  [(p) => p === '/users' || p === '/admin' || p === '/settings' || p.startsWith('/admin/'), {
    en: 'This is Admin: users, their access, companies and app settings.',
    ru: 'Yeh Admin hai: users, un ka access, companies aur settings.',
    ur: 'یہ ایڈمن ہے: یوزرز، ان کا اختیار، کمپنیاں اور سیٹنگز۔',
    ar: 'هذي الإدارة: المستخدمين وصلاحياتهم والشركات وإعدادات البرنامج.'
  }],
  [(p) => p.startsWith('/lead-staff') || p.startsWith('/chairman') || p.startsWith('/faisal'), {
    en: 'This is Lead Staff: approvals and the complete summary of the group.',
    ru: 'Yeh Lead Staff hai: approvals aur poore group ka summary.',
    ur: 'یہ لیڈ اسٹاف ہے: منظوریاں اور پورے گروپ کا خلاصہ۔',
    ar: 'هذي القيادة: الموافقات والملخص الكامل للمجموعة.'
  }]
];

/* the intro of a page in a language ('' when the page has none) */
export function pageIntro(path, lang) {
  const p = String(path || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const hit = PAGES.find(([test]) => test(p));
  if (!hit) return '';
  return hit[1][lang] || hit[1].en;
}
