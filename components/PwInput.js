'use client';

import { forwardRef, useState } from 'react';

/*
  👁 Password box with an eye button (19 Nov 2026, Kamran: "so that I know whether I am typing right or not").
  Tap the eye to show the password, tap again to hide it. Same props as <input>.
*/
const PwInput = forwardRef(function PwInput({ className = '', ...props }, ref) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw-wrap">
      <input ref={ref} {...props} className={className} type={show ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="button" className="pw-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide password' : 'Show password'} tabIndex={-1}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {!show && <path d="M4 20 20 4" />}
        </svg>
      </button>
    </span>
  );
});

export default PwInput;
