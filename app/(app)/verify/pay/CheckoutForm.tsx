'use client'

import { useEffect, useState } from 'react'

type Currency = 'aed' | 'gbp' | 'usd'

type Props = {
  verificationRequestId: string
  tier: string
  tierLabel: string
  amounts: Record<Currency, number | null>  // minor units (pence/cents/fils)
}

function formatAmount(amount: number | null, currency: Currency): string {
  if (amount === null) return '—'
  const major = amount / 100
  if (currency === 'gbp') return `£${major.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
  if (currency === 'usd') return `$${major.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  return `AED ${major.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`
}

function detectDefaultCurrency(): Currency {
  if (typeof navigator === 'undefined') return 'aed'
  const locale = navigator.language
  if (locale.startsWith('en-GB')) return 'gbp'
  if (locale.startsWith('en-US') || locale.startsWith('en-CA')) return 'usd'
  return 'aed'
}

const CURRENCIES: { key: Currency; label: string }[] = [
  { key: 'aed', label: 'AED' },
  { key: 'gbp', label: 'GBP' },
  { key: 'usd', label: 'USD' },
]

export default function CheckoutForm({ verificationRequestId, tier, tierLabel, amounts }: Props) {
  const [currency, setCurrency] = useState<Currency>('aed')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    setCurrency(detectDefaultCurrency())
  }, [])

  async function handleContinue() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/verify/create-checkout-session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tier, currency, verification_request_id: verificationRequestId }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const selectedAmount = amounts[currency]
  const currencyUnavailable = selectedAmount === null

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-navy mb-2">{tierLabel} verification</h1>
      <p className="text-base text-body-grey mb-8">
        One-time payment. Your verified badge appears on your profile once confirmed.
      </p>

      {/* Currency selector */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-3" style={{ color: 'rgba(15,27,60,0.70)' }}>Pay in:</p>
        <div className="flex items-center gap-3">
          {CURRENCIES.map(({ key, label }) => {
            const unavailable = amounts[key] === null
            const selected    = currency === key
            return (
              <button
                key={key}
                onClick={() => !unavailable && setCurrency(key)}
                disabled={unavailable}
                title={unavailable ? 'Not available in this currency' : undefined}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  unavailable
                    ? 'opacity-30 cursor-not-allowed border-border text-body-grey'
                    : selected
                    ? 'bg-navy text-warm-white border-navy'
                    : 'bg-warm-white text-navy border-navy hover:bg-navy/5'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Price display */}
      <div className="mb-8">
        <p
          className="font-display font-black text-navy leading-none"
          style={{ fontSize: 'clamp(40px, 10vw, 56px)' }}
        >
          {currencyUnavailable ? 'N/A' : formatAmount(selectedAmount, currency)}
        </p>
        {currencyUnavailable && (
          <p className="text-xs text-body-grey mt-2">
            This currency is not available. Please select another.
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-body-grey bg-surface border border-border px-4 py-3 rounded-xl mb-4">
          {error}
        </p>
      )}

      <button
        onClick={handleContinue}
        disabled={loading || currencyUnavailable}
        className="w-full py-3.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-40"
        style={{ backgroundColor: 'var(--lime)', color: 'var(--navy)' }}
      >
        {loading ? 'Preparing checkout…' : 'Continue to payment'}
      </button>

      <p className="text-center text-xs text-body-grey mt-4 leading-relaxed">
        Payments processed securely by Stripe. You will be redirected to complete payment.
      </p>
    </div>
  )
}
