'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Bank, PaymentSession } from '@/types/payment'
import { ApiFailure, USE_MOCK_DATA, cancel, getBanks, getSession, getStatus, initiate } from '@/lib/api'
import {
  isFinal,
  isPastExpiry,
  loadToken,
  paymentIdFromPathname,
  safeHttpUrl,
  saveToken,
  screenForStatus,
  tokenFromSearch,
  formatAmount,
  bankLabel,
} from '@/lib/logic.mjs'
import Shell from './Shell'
import StatePanel from './StatePanel'
import PaymentSummary from './PaymentSummary'
import BankPicker from './BankPicker'

type Phase = 'loading' | 'ready' | 'error' | 'redirecting'
type ErrorKind = 'invalid' | 'network' | 'server'

const POLL_MS = 4000

export default function HostedSession() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [errorKind, setErrorKind] = useState<ErrorKind>('server')
  const [session, setSession] = useState<PaymentSession | null>(null)
  const [banks, setBanks] = useState<Bank[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [redirect, setRedirect] = useState<{ url: string; bank: string } | null>(null)

  // The token lives in memory (and sessionStorage for reloads), never in the address bar or localStorage.
  const ctx = useRef<{ paymentId: string; token: string } | null>(null)

  const fail = useCallback((e: unknown) => {
    const kind = e instanceof ApiFailure ? e.kind : 'server'
    setErrorKind(kind)
    setPhase('error')
  }, [])

  const load = useCallback(async () => {
    setPhase('loading')
    setNotice(null)
    setBusyId(null)

    if (!ctx.current) {
      const paymentId = paymentIdFromPathname(window.location.pathname) ?? (USE_MOCK_DATA ? 'pay_demo' : null)
      const fromUrl = tokenFromSearch(window.location.search)
      const token = (paymentId && (fromUrl || loadToken(window.sessionStorage, paymentId))) || (USE_MOCK_DATA ? 'mock' : null)
      if (paymentId && token) {
        if (fromUrl) saveToken(window.sessionStorage, paymentId, fromUrl)
        ctx.current = { paymentId, token }
      }
      // Strip the token (and any other query string) from the address bar and history entry.
      if (window.location.search || window.location.hash) {
        window.history.replaceState(window.history.state, '', window.location.pathname)
      }
    }
    if (!ctx.current) {
      setErrorKind('invalid')
      setPhase('error')
      return
    }

    const { paymentId, token } = ctx.current
    try {
      const s = await getSession(paymentId, token)
      let status = s
      if (isPastExpiry(s)) status = { ...s, status: 'EXPIRED' }
      if (screenForStatus(status.status) === 'choose') setBanks(await getBanks(token))
      setSession(status)
      setConfirmCancel(false)
      setPhase('ready')
    } catch (e) {
      fail(e)
    }
  }, [fail])

  useEffect(() => {
    void load()
    // Coming back from the bank with the back button: show the page again instead of a frozen "redirecting" screen.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void load()
    }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [load])

  // While the bank is processing the payment, keep checking until it settles.
  const screen = session ? screenForStatus(session.status) : null
  useEffect(() => {
    if (phase !== 'ready' || screen !== 'processing' || !ctx.current) return
    const { paymentId, token } = ctx.current
    const timer = setInterval(async () => {
      try {
        const s = await getStatus(paymentId, token)
        setSession(s)
      } catch {
        /* keep the current screen; the next poll tries again */
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [phase, screen])

  // Follow the bank link after the "redirecting" screen has been shown.
  useEffect(() => {
    if (!redirect) return
    const t = setTimeout(() => window.location.assign(redirect.url), 350)
    return () => clearTimeout(t)
  }, [redirect])

  async function chooseBank(bank: Bank) {
    if (!ctx.current || busyId) return
    const { paymentId, token } = ctx.current
    setBusyId(bank.id)
    setNotice(null)
    try {
      const result = await initiate(paymentId, bank.id, token)
      if (isFinal(result.status)) {
        await load()
        return
      }
      const url = safeHttpUrl(result.redirectUrl)
      if (!url) {
        setNotice("We couldn't start your payment with this bank. Try again or choose another bank.")
        setBusyId(null)
        return
      }
      setRedirect({ url, bank: bankLabel(bank) })
      setPhase('redirecting')
    } catch (e) {
      setBusyId(null)
      if (e instanceof ApiFailure && e.code === 'PAYMENT_NOT_PENDING') {
        await load()
      } else if (e instanceof ApiFailure && e.kind === 'invalid') {
        fail(e)
      } else if (e instanceof ApiFailure && e.kind === 'network') {
        setNotice("We couldn't reach Syntropi. Check your connection and try again.")
      } else {
        setNotice("We couldn't start your payment with this bank. Try again or choose another bank.")
      }
    }
  }

  async function cancelPayment() {
    if (!ctx.current) return
    setCancelling(true)
    setNotice(null)
    try {
      const s = await cancel(ctx.current.paymentId, ctx.current.token)
      setSession(s)
      setConfirmCancel(false)
    } catch (e) {
      if (e instanceof ApiFailure && e.kind === 'invalid') fail(e)
      else if (e instanceof ApiFailure && e.code === 'PAYMENT_NOT_PENDING') await load()
      else setNotice("We couldn't cancel the payment. Try again.")
    } finally {
      setCancelling(false)
    }
  }

  const merchantUrl = safeHttpUrl(session?.merchant?.redirectUri)
  const merchantName = session?.merchant?.name || 'the merchant'
  const backToMerchant = merchantUrl ? (
    <a className="btn-primary" href={merchantUrl} rel="noreferrer noopener" data-testid="return-link">
      Return to {merchantName}
      <ArrowRight size={18} aria-hidden="true" />
    </a>
  ) : null

  let body: React.ReactNode
  if (phase === 'loading') {
    body = <StatePanel testId="state-loading" icon="loading" title="Loading your payment" live />
  } else if (phase === 'error') {
    if (errorKind === 'invalid') {
      body = (
        <StatePanel testId="state-invalid" icon="invalid" title="Link not valid">
          This link isn&apos;t valid anymore. Return to the merchant and try again.
        </StatePanel>
      )
    } else {
      const network = errorKind === 'network'
      body = (
        <StatePanel
          testId={network ? 'state-network' : 'state-server'}
          icon={network ? 'network' : 'failed'}
          title={network ? "Can't reach Syntropi" : 'Something went wrong'}
          actions={<button type="button" className="btn-primary" onClick={() => void load()}>Try again</button>}
        >
          {network
            ? 'Check your internet connection and try again.'
            : "That didn't work on our side. Try again in a moment. If it keeps happening, return to the merchant."}
        </StatePanel>
      )
    }
  } else if (phase === 'redirecting' && redirect) {
    body = (
      <StatePanel
        testId="state-redirecting"
        icon="bank"
        title="Taking you to your bank"
        live
        actions={
          <a className="btn-quiet" href={redirect.url} data-testid="continue-link">
            Continue to {redirect.bank}
          </a>
        }
      >
        You&apos;re being sent to {redirect.bank} to approve the payment. Keep this window open.
      </StatePanel>
    )
  } else if (session) {
    const amount = formatAmount(session.amount.value, session.amount.currency)
    switch (screen) {
      case 'completed':
        body = (
          <StatePanel testId="state-completed" icon="ok" title="Payment complete" actions={backToMerchant}>
            Your payment of {amount} to {merchantName} went through. You can close this page.
          </StatePanel>
        )
        break
      case 'failed':
        body = (
          <StatePanel testId="state-failed" icon="failed" title="Payment didn't go through" actions={backToMerchant}>
            This payment wasn&apos;t approved, so no money has been taken. Return to the merchant to try again.
          </StatePanel>
        )
        break
      case 'cancelled':
        body = (
          <StatePanel testId="state-cancelled" icon="cancelled" title="Payment cancelled" actions={backToMerchant}>
            This payment was cancelled and no money has been taken.
          </StatePanel>
        )
        break
      case 'expired':
        body = (
          <StatePanel testId="state-expired" icon="expired" title="This payment has expired" actions={backToMerchant}>
            Payments can only be approved for a limited time. Return to the merchant to start again.
          </StatePanel>
        )
        break
      case 'processing':
        body = (
          <StatePanel testId="state-processing" icon="loading" title="Your bank is processing the payment" live actions={backToMerchant}>
            This can take a minute. This page updates by itself, so you don&apos;t need to refresh it.
          </StatePanel>
        )
        break
      default:
        body = (
          <div data-testid="state-choose">
            <PaymentSummary session={session} />
            {notice ? <p className="alert" role="alert" data-testid="notice">{notice}</p> : null}
            <BankPicker banks={banks} busyId={busyId} onSelect={chooseBank} />
            <div className="card-foot">
              {confirmCancel ? (
                <div className="actions" role="group" aria-label="Cancel this payment?" style={{ marginTop: 0, justifyContent: 'center' }}>
                  <button type="button" className="btn-quiet" onClick={cancelPayment} disabled={cancelling} data-testid="confirm-cancel">
                    Yes, cancel payment
                  </button>
                  <button type="button" className="btn-quiet" onClick={() => setConfirmCancel(false)} disabled={cancelling}>
                    Keep going
                  </button>
                </div>
              ) : (
                <button type="button" className="link-quiet" onClick={() => setConfirmCancel(true)} disabled={busyId !== null} data-testid="cancel">
                  Cancel payment
                </button>
              )}
            </div>
          </div>
        )
    }
  }

  return <Shell>{body}</Shell>
}
