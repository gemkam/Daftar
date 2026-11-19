'use client';

import { useMyCompanies, useCompanyChoices } from '@/lib/myCompanies';
import Link from 'next/link';
import { COMPANIES } from '@/lib/expenses';

/*
  All Companies tabs shown on every Transport page (Transport lives inside All Companies as the 4th tab)
  and on the Documents Checklist (/docs, last tab since 31 Oct 2026).
  Same look as the tabs on /expenses (co-switch CSS). active: 'transport' | 'docs'. 🧾 VAT return (next to Checklist) opens the VAT return tab of the Reports & Summary.
*/
export default function OfficeTabs({ active = 'transport', user = null }) {
  const myCos = useMyCompanies(user);
  const coChoices = useCompanyChoices(user);
  return (
    <div className="co-switch office-tabs no-print" role="tablist" aria-label="All Companies">
      {coChoices.map((c) => (c.mine ? <Link key={c.key} href={`/expenses?co=${c.key}`} role="tab" className="co-tab">{c.short}</Link> : <span key={c.key} role="tab" aria-disabled="true" className="co-tab co-off" title="No access to this company">{c.short}</span>))}
      {active === 'transport'
        ? <span className="co-tab on" role="tab" aria-selected="true">🚚 Transport</span>
        : <Link href="/transport" role="tab" className="co-tab">🚚 Transport</Link>}
      {active === 'docs'
        ? <span className="co-tab co-sum on" role="tab" aria-selected="true">📋 Checklist</span>
        : <Link href="/docs" className="co-tab co-sum">📋 Checklist</Link>}
      <Link href="/expenses/docs?kind=receipt" className="co-tab">🧾 Bills</Link>
      <Link href="/expenses/salary" className="co-tab">💰 Salary</Link>
      <Link href="/expenses/vat" className="co-tab co-sum co-vat">🧾 VAT return</Link>
    </div>
  );
}
