import type { PaymentSession } from '@/types/payment'
import { formatAmount } from '@/lib/logic.mjs'

export default function PaymentSummary({ session }: { session: PaymentSession }) {
  const payee = session.merchant?.name || session.toAccount?.accountName
  const ref = session.reference || session.description
  return (
    <div className="summary" data-testid="summary">
      <span className="summary-merchant">Pay {payee}</span>
      <span className="summary-amount mono">{formatAmount(session.amount.value, session.amount.currency)}</span>
      {ref ? <span className="summary-ref">Reference: {ref}</span> : null}
    </div>
  )
}
