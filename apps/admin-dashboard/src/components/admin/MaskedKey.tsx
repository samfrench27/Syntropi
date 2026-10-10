import React from 'react';

/** A key as the API lists it: the visible prefix, then dots. The full key is never available after creation. */
export default function MaskedKey({ prefix, className = '' }: { prefix?: string | null; className?: string }) {
  return (
    <span className={`mono ${className}`} title="The full key is only shown once, when it is created">
      {prefix || 'sk_'}
      <span aria-hidden>{'••••••••••••'}</span>
      <span className="sr-only"> (hidden)</span>
    </span>
  );
}
