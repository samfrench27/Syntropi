import { Shell } from '@/components/Shell';
import { Building2, CheckCircle2, ShoppingBag } from 'lucide-react';

const steps = [
  { icon: ShoppingBag, title: 'Start from a merchant', text: 'A merchant creates a test payment with the Mock bank as the provider and sends you here.' },
  { icon: Building2, title: 'Log in with test details', text: 'You use made-up login details. There are no real accounts.' },
  { icon: CheckCircle2, title: 'Approve or reject', text: 'You decide, then you are sent back to the merchant with the result.' },
];

export default function HomePage() {
  return (
    <Shell>
      <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--d-ink)' }}>
        The practice bank for test payments
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--d-ink-2)' }}>
        Mock bank lets developers try the whole payment journey without a real bank. There is nothing to log in to here. Payments start from a merchant.
      </p>
      <ol className="panel mt-5 divide-y" style={{ borderColor: 'var(--d-panel-edge)' }}>
        {steps.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 px-4 py-3.5" style={{ borderColor: 'var(--d-panel-edge)' }}>
            <Icon size={20} className="mt-0.5 shrink-0" style={{ color: 'var(--d-accent-ink)' }} aria-hidden />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--d-ink)' }}>{title}</p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--d-ink-2)' }}>{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm" style={{ color: 'var(--d-ink-2)' }}>
        Got here by mistake? Go back to the merchant you were paying.
      </p>
    </Shell>
  );
}
