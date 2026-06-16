'use client'

import { useState } from 'react'
import Link from 'next/link'

export type MatchPair = {
  memberAId:   string
  memberBId:   string
  memberAName: string
  memberBName: string
  memberASlug: string
  memberBSlug: string
}

const cardCls =
  'bg-white border border-border rounded-2xl shadow-[0_4px_16px_rgba(15,27,60,0.08)] hover:shadow-[0_8px_24px_rgba(15,27,60,0.13)] hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200'

export default function MatchmakerCard({ pairs }: { pairs: MatchPair[] }) {
  const [index,      setIndex]      = useState(0)
  const [dismissing, setDismissing] = useState(false)

  const pair = pairs[index] ?? null

  async function handleDismiss() {
    if (!pair || dismissing) return
    setDismissing(true)
    // Advance immediately (optimistic) — fire-and-forget the API call
    setIndex(i => i + 1)
    try {
      await fetch('/api/matchmaker/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberAId: pair.memberAId, memberBId: pair.memberBId }),
      })
    } catch {
      // Silent — dismissal is best-effort; worst case it reappears on next load
    } finally {
      setDismissing(false)
    }
  }

  if (!pair) {
    return (
      <div className={`${cardCls} p-6`}>
        <p className="text-sm text-body-grey">
          No pairings to suggest right now — check back later.
        </p>
      </div>
    )
  }

  return (
    <div className={`${cardCls} p-6`}>
      <p className="text-sm font-medium text-navy mb-4">
        Do you think{' '}
        <Link href={`/profile/${pair.memberASlug}`} className="underline underline-offset-2">
          {pair.memberAName}
        </Link>{' '}
        and{' '}
        <Link href={`/profile/${pair.memberBSlug}`} className="underline underline-offset-2">
          {pair.memberBName}
        </Link>{' '}
        should meet?
      </p>
      <div className="flex gap-2 flex-wrap">
        <Link
          href={`/intro/facilitate/${pair.memberAId}/${pair.memberBId}`}
          className="text-xs font-medium bg-navy text-warm-white px-4 py-2 rounded-full
            hover:bg-navy/90 hover:scale-[1.02]
            hover:shadow-[0_0_12px_rgba(200,245,60,0.4)]
            transition-all duration-150"
        >
          Yes — draft intro
        </Link>
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="text-xs font-medium text-body-grey border border-border px-4 py-2 rounded-full
            hover:border-navy hover:text-navy hover:scale-[1.02]
            transition-all duration-150 disabled:opacity-40"
        >
          Not this time
        </button>
      </div>
    </div>
  )
}
