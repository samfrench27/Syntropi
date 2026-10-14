import { FlaskConical } from 'lucide-react';

/** Page frame: brand, the floating glass card, and the "no real money" notice. Data goes on opaque panels inside. */
export function Shell({ children, busy }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-2" style={{ color: 'var(--d-ink)' }}>
          <FlaskConical size={22} aria-hidden />
          <p className="text-2xl font-semibold tracking-tight">Mock bank</p>
        </div>
        <div className="glass p-5 sm:p-8" style={{ borderRadius: 'var(--d-r-sheet)' }} aria-busy={busy || undefined}>
          <p
            className="mb-5 px-3 py-2 text-center text-xs font-medium"
            style={{ borderRadius: 'var(--d-r-ctl)', background: 'var(--d-accent-soft)', color: 'var(--d-ink)' }}
          >
            Mock bank, no real money. This is a practice bank for test payments.
          </p>
          {children}
        </div>
        <p className="mt-5 text-center text-xs" style={{ color: 'var(--d-ink-2)' }}>
          Part of Syntropi. Nothing you enter here is stored.
        </p>
      </div>
    </main>
  );
}
