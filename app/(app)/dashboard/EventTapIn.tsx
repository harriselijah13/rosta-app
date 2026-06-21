'use client'

import { useState } from 'react'

type Props = { isTappedIn: boolean }

export default function EventTapIn({ isTappedIn: initialTappedIn }: Props) {
  const [tappedIn, setTappedIn] = useState(initialTappedIn)
  const [loading,  setLoading]  = useState(false)

  async function handleTapIn() {
    if (tappedIn || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/event/tap-in', { method: 'POST' })
      if (res.ok) setTappedIn(true)
    } catch {
      // silent — worst case, state doesn't update
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-border rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          {tappedIn ? (
            <>
              <p className="text-base font-semibold text-navy">
                You&apos;re tapped in.
              </p>
              <p className="text-sm mt-1" style={{ color: 'rgba(15,27,60,0.70)' }}>
                Tomorrow morning we&apos;ll nudge you with the names worth following up on.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-navy">
                At a networking event today?
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(107,114,128,0.65)' }}>
                Tap in to remember who you met. We&apos;ll help you turn the right conversations into connections.
              </p>
            </>
          )}
        </div>
        {!tappedIn && (
          <button
            onClick={handleTapIn}
            disabled={loading}
            className="shrink-0 text-xs font-medium text-navy border border-navy px-3.5 py-1.5 rounded-full hover:bg-navy hover:text-warm-white transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? '…' : 'Tap in'}
          </button>
        )}
      </div>
    </div>
  )
}
