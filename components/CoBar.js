'use client';

import CompanyLock from '@/components/CompanyLock';
import { isCompanyUnlocked } from '@/lib/companyAccess';

/* Company buttons on top of CRM, Quotations and Leave requests (lib/coPick.js) */
export default function CoBar({ pick }) {
  const { list, co, choose, ask, setAsk, opened } = pick;
  return (
    <>
      {list.length > 1 && (
        <div className="co-switch no-print" role="tablist" aria-label="Company">
          {list.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={co === x.key} className={co === x.key ? 'on' : ''} onClick={() => choose(x.key)}>
              {x.short}{!isCompanyUnlocked(x.key) ? ' 🔒' : ''}
            </button>
          ))}
        </div>
      )}
      {ask && <CompanyLock company={ask} onCancel={() => setAsk(null)} onOpen={opened} />}
    </>
  );
}
