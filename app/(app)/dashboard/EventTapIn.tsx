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
          <p className="text-sm font-medium text-navy">
            {tappedIn ? 'You\'re tapped in.' : 'At a networking event today?'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(107,114,128,0.65)' }}>
            {tappedIn
              ? 'We\'ll prompt you to capture names tomorrow.'
              : 'Tap in to remember who you met. We\'ll help you turn the right conversations into connections.'}
          </p>
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
