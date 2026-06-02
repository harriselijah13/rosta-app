'use client'

import { useState } from 'react'
import QRCode from 'react-qr-code'
function guestQrUrl(token: string) {
  return `https://app.onrosta.com/connect/${token}`
}

type Props = {
  initialToken: string
  initialExpiresAt: string
}

function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
}

export default function GuestQRSection({ initialToken, initialExpiresAt }: Props) {
  const [token, setToken] = useState(initialToken)
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const url = guestQrUrl(token)

  async function regenerate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/qr/guest/new', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to generate.'); return }
      setToken(data.token)
      setExpiresAt(data.expiresAt)
    } catch {
      setError('Failed to generate new QR.')
    } finally {
      setLoading(false)
    }
  }

  const days = daysLeft(expiresAt)

  return (
    <section className="max-w-2xl mx-auto px-6 pb-10">
      <div className="bg-white border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="font-display text-xl font-bold text-navy mb-1">Guest QR code</h2>
            <p className="text-sm text-body-grey">
              Show this to someone without ROSTA. They scan, fill in their details, and get an invite email.
            </p>
          </div>
          <span className={`text-xs font-medium px-3 py-1 rounded-full border ${
            days > 2
              ? 'bg-green-50 text-green-700 border-green-200'
              : days > 0
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-red-50 text-red-600 border-red-200'
          }`}>
            {days > 0 ? `${days}d left` : 'Expired'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="bg-surface border border-border rounded-xl p-4 shrink-0">
            <QRCode value={url} size={140} fgColor="#0F1B3C" bgColor="#F5F2EE" />
          </div>

          <div className="flex flex-col gap-3 min-w-0">
            <p className="text-xs text-body-grey font-mono break-all">{url}</p>
            <p className="text-xs text-body-grey">
              Works on any phone — no app needed. Expires in {days} day{days !== 1 ? 's' : ''}.
            </p>
            <button
              type="button"
              onClick={regenerate}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm font-medium border border-border text-body-grey px-4 py-2 rounded-full hover:border-navy hover:text-navy transition-colors w-fit disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Generating…' : 'New QR (fresh 7 days)'}
            </button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
