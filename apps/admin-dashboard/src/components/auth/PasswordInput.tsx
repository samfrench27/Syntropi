'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Extra classes for the wrapper around the input and the eye button. */
  wrapperClassName?: string;
};

/**
 * A password field with an eye button on the right that shows or hides what was typed.
 * Takes every normal input prop, so it fits the glass styling (className="ctl-input") and the older
 * Tailwind forms alike. Hidden by default, and never remembered.
 */
export default function PasswordInput({ className = '', wrapperClassName = '', style, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={className}
        // Room for the button. Inline because .ctl-input sets its own padding.
        style={{ ...style, paddingRight: '3rem' }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[inherit] transition-colors hover:bg-[var(--d-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ color: 'var(--d-ink-2)' }}
      >
        {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  );
}
