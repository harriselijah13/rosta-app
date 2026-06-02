'use client'

import { useState } from 'react'

type Props = {
  conversationId: string
  hasOutcome: boolean
  introRequestId: string | null
  facilitatorId: string | null
  currentUserId: string
  thankYouSent: boolean
}

export default function OutcomeActions({
  conversationId,
  hasOutcome: initialHasOutcome,
  introRequestId,
  facilitatorId,
  currentUserId,
  thankYouSent: initialThankYouSent,
}: Props) {
  const [hasOutcome, setHasOutcome] = useState(initialHasOutcome)
  const [thankYouSent, setThankYouSent] = useState(initialThankYouSent)
  const [markingOutcome, setMarkingOutcome] = useState(false)
  const [sendingThankYou, setSendingThankYou] = useState(false)

  const isIntroMaker = facilitatorId === currentUserId
  const canThankYou = !!introRequestId && !!facilitatorId && !isIntroMaker

  async function markOutcome() {
    if (hasOutcome || markingOutcome) return
    setMarkingOutcome(true)
    try {
      await fetch('/api/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      })
      setHasOutcome(true)
    } finally {
      setMarkingOutcome(false)
    }
  }

  async function sendThankYou() {
    if (thankYouSent || sendingThankYou || !introRequestId) return
    setSendingThankYou(true)
    try {
      await fetch(`/api/thank-you/${introRequestId}`, { method: 'POST' })
      setThankYouSent(true)
    } finally {
      setSendingThankYou(false)
    }
  }

  if (!canThankYou && hasOutcome) return null

  return (
    <div className="shrink-0 border-t border-border bg-surface px-4 py-2.5 flex items-center gap-3 flex-wrap">
      {!hasOutcome ? (
        <button
          onClick={markOutcome}
          disabled={markingOutcome}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-body-grey hover:text-navy transition-colors disabled:opacity-50"
        >
          <span className="w-4 h-4 rounded-full border border-body-grey/40 flex items-center justify-center">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          {markingOutcome ? 'Marking…' : 'This led to something'}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-navy">
          <span className="w-4 h-4 rounded-full bg-lime flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          Outcome marked
        </span>
      )}

      {canThankYou && (
        <>
          <span className="text-border">·</span>
          {!thankYouSent ? (
            <button
              onClick={sendThankYou}
              disabled={sendingThankYou}
              className="text-xs font-medium text-body-grey hover:text-navy transition-colors disabled:opacity-50"
            >
              {sendingThankYou ? 'Sending…' : 'Say thank you to intro-maker'}
            </button>
          ) : (
            <span className="text-xs font-medium text-navy">Thank you sent ✓</span>
          )}
        </>
      )}
    </div>
  )
}
