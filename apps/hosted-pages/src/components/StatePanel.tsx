import { AlertCircle, Ban, Check, Loader2, TimerOff, WifiOff, X } from 'lucide-react'

export type StateIcon = 'loading' | 'ok' | 'failed' | 'cancelled' | 'expired' | 'invalid' | 'network' | 'bank'

const ICONS = {
  loading: { Icon: Loader2, tone: 'idle', spin: true },
  bank: { Icon: Loader2, tone: 'idle', spin: true },
  ok: { Icon: Check, tone: 'ok', spin: false },
  failed: { Icon: AlertCircle, tone: 'bad', spin: false },
  cancelled: { Icon: X, tone: 'idle', spin: false },
  expired: { Icon: TimerOff, tone: 'warn', spin: false },
  invalid: { Icon: Ban, tone: 'bad', spin: false },
  network: { Icon: WifiOff, tone: 'warn', spin: false },
} as const

interface Props {
  icon: StateIcon
  title: string
  children?: React.ReactNode
  actions?: React.ReactNode
  /** Announce to screen readers when it appears (loading and redirecting screens). */
  live?: boolean
  testId: string
}

/** One status screen: icon, heading, plain-language text and optional actions. */
export default function StatePanel({ icon, title, children, actions, live, testId }: Props) {
  const { Icon, tone, spin } = ICONS[icon]
  return (
    <section className="state" data-testid={testId} role={live ? 'status' : undefined} aria-live={live ? 'polite' : undefined}>
      <div className="badge" data-tone={tone}>
        <Icon size={26} aria-hidden="true" className={spin ? 'spin' : undefined} />
      </div>
      <h1 className="title">{title}</h1>
      {children ? <div className="lead">{children}</div> : null}
      {actions ? <div className="actions">{actions}</div> : null}
    </section>
  )
}
