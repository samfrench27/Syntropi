import Shell from '@/components/Shell'
import StatePanel from '@/components/StatePanel'

export default function HomePage() {
  return (
    <Shell>
      <StatePanel testId="home" icon="invalid" title="Open your payment link">
        This page is opened from a payment link. Return to the merchant and start your payment again.
      </StatePanel>
    </Shell>
  )
}
