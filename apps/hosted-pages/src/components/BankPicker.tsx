'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import type { Bank } from '@/types/payment'
import { bankInitial, bankLabel, filterBanks, safeHttpUrl } from '@/lib/logic.mjs'

function BankLogo({ bank }: { bank: Bank }) {
  const [failed, setFailed] = useState(false)
  const src = safeHttpUrl(bank.logoUrl)
  return (
    <span className="logo" aria-hidden="true">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        bankInitial(bank)
      )}
    </span>
  )
}

interface Props {
  banks: Bank[]
  /** Bank id being started, if any. */
  busyId: string | null
  onSelect: (bank: Bank) => void
}

/** Search box and a list of buttons: every bank is reachable and usable from the keyboard. */
export default function BankPicker({ banks, busyId, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const shown = useMemo(() => filterBanks(banks, query), [banks, query])
  const busy = busyId !== null

  if (banks.length === 0) {
    return (
      <p className="empty" data-testid="no-banks">
        No banks are available for this payment yet. Return to the merchant and try again.
      </p>
    )
  }

  return (
    <div data-testid="bank-picker">
      <label className="field-label" htmlFor="bank-search">Choose your bank</label>
      <div className="search">
        <Search size={18} aria-hidden="true" />
        <input
          id="bank-search"
          type="search"
          autoComplete="off"
          placeholder="Search banks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={busy}
        />
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {shown.length === 1 ? '1 bank' : `${shown.length} banks`}
      </p>
      {shown.length === 0 ? (
        <p className="empty" data-testid="no-match">No banks match “{query.trim()}”. Try a different name.</p>
      ) : (
        <ul className="bank-list" aria-label="Banks">
          {shown.map((bank) => (
            <li key={bank.id}>
              <button
                type="button"
                className="bank"
                data-testid="bank"
                data-bank-id={bank.id}
                disabled={busy}
                aria-busy={busyId === bank.id}
                onClick={() => onSelect(bank)}
              >
                <BankLogo bank={bank} />
                <span className="bank-name">{bankLabel(bank)}</span>
                <ChevronRight size={18} className="bank-chevron" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
