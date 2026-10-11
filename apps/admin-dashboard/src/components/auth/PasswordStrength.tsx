'use client';

import React from 'react';
import { Check, Circle } from 'lucide-react';
import { evaluatePassword, type PasswordContext } from '@repo/password-policy';

interface Props extends PasswordContext {
  password: string;
  /** Used to tie the field to its guidance with aria-describedby. */
  id: string;
}

const TONES = ['var(--d-ink-3)', 'var(--d-bad)', 'var(--d-warn)', 'var(--d-ok)', 'var(--d-ok)'];
const TEXT_TONES = ['var(--d-ink-2)', 'var(--d-bad-ink)', 'var(--d-warn-ink)', 'var(--d-ok-ink)', 'var(--d-ok-ink)'];

/**
 * What a good password needs, ticking off as the person types, with a four-step strength meter.
 * The rules are the shared policy the API enforces (packages/password-policy), so what shows here is
 * what is actually checked. Meaning is never carried by colour alone: the meter has a text label and
 * every requirement has an icon and a spoken "met" or "not yet".
 */
export default function PasswordStrength({ password, id, email, names }: Props) {
  const result = evaluatePassword(password, { email, names });
  const typing = password.length > 0;

  return (
    <div id={id} className="mt-3 text-sm" style={{ color: 'var(--d-ink-2)' }}>
      {typing && (
        <div className="mb-3">
          <div className="flex gap-1.5" aria-hidden>
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className="h-1.5 flex-1 rounded-full transition-colors duration-300"
                style={{ background: step <= result.score ? TONES[result.score] : 'var(--d-panel-edge)' }}
              />
            ))}
          </div>
          {/* Announced politely as it changes */}
          <p aria-live="polite" className="mt-1.5 font-medium" style={{ color: TEXT_TONES[result.score] }}>
            Password strength: {result.label}
          </p>
        </div>
      )}

      <ul aria-label="Password requirements" className="space-y-1">
        {result.checks.map((check) => (
          <li key={check.id} className="flex items-center gap-2">
            {check.met && typing ? (
              <Check size={15} aria-hidden style={{ color: 'var(--d-ok-ink)' }} />
            ) : (
              <Circle size={15} aria-hidden style={{ color: 'var(--d-ink-3)' }} />
            )}
            <span style={{ color: check.met && typing ? 'var(--d-ink)' : undefined }}>{check.label}</span>
            <span className="sr-only">{check.met && typing ? '(met)' : '(not yet)'}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs" style={{ color: 'var(--d-ink-3)' }}>
        Longer is stronger. A few random words make a good password.
      </p>
    </div>
  );
}
