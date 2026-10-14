'use client';

import React, { useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, Download } from 'lucide-react';

/**
 * Shown once, straight after a key is created. The server never returns the full key again
 * (lists and details only carry the prefix), so the notice says so plainly.
 */
export default function ApiKeyReveal({ apiKey, fileName = 'syntropi-api-key.txt' }: { apiKey: string; fileName?: string }) {
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 3000);
  };

  return (
    <div className="space-y-4">
      <div
        className="flex items-start gap-3 px-4 py-3 text-sm"
        style={{ borderRadius: 'var(--d-r-ctl)', background: 'color-mix(in srgb, var(--d-warn) 16%, transparent)', color: 'var(--d-ink)' }}
      >
        <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--d-warn-ink)' }} aria-hidden />
        <p>
          <strong>Copy this key now. You won&apos;t see it again.</strong> We only keep a scrambled copy, so we can&apos;t show it later.
          If you lose it, create a new key and revoke this one.
        </p>
      </div>

      <div>
        <label htmlFor="new-api-key" className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--d-ink)' }}>
          Your API key
        </label>
        <div className="flex items-stretch gap-2">
          <input
            id="new-api-key"
            readOnly
            value={apiKey}
            onFocus={(e) => e.currentTarget.select()}
            className="ctl-input mono min-w-0 flex-1 text-sm"
          />
          <button type="button" onClick={copy} className="btn-primary shrink-0">
            {copied === 'done' ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copied === 'done' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p role="status" aria-live="polite" className="mt-1.5 min-h-5 text-sm" style={{ color: copied === 'failed' ? 'var(--d-bad-ink)' : 'var(--d-ok-ink)' }}>
          {copied === 'done' && 'Copied to your clipboard.'}
          {copied === 'failed' && 'Could not copy automatically. Select the key and copy it yourself.'}
        </p>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(apiKey)}`}
          download={fileName}
          className="btn-quiet mt-2 w-full sm:w-auto"
        >
          <Download size={16} aria-hidden /> Download as a text file
        </a>
      </div>
    </div>
  );
}
