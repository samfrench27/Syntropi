import { ShieldCheck } from 'lucide-react'

/** Page frame: glass top bar, content card, footer. */
export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="stage">
      <header className="topbar glass">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">S</span>
          Syntropi
        </span>
        <span className="secure">
          <ShieldCheck size={16} aria-hidden="true" />
          Secure payment
        </span>
      </header>
      <main className="card panel pop-in">{children}</main>
      <footer className="foot">Payments by Syntropi</footer>
    </div>
  )
}
