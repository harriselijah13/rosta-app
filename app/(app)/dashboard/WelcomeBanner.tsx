'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'rosta_welcome_dismissed'

const ACTIONS = [
  {
    label:       'Browse members',
    description: 'find people worth knowing',
    href:        '/members',
  },
  {
    label:       'Set your signals',
    description: 'help the network find you',
    href:        '/settings',
  },
  {
    label:       'Share your invite codes',
    description: 'bring someone you trust',
    href:        '/settings',
  },
]

export default function WelcomeBanner({ hasConnections }: { hasConnections: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (hasConnections) return
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [hasConnections])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="bg-navy rounded-2xl p-6 mb-8">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="font-display text-xl font-bold text-warm-white leading-tight">
            You&apos;re in.
          </p>
          <p className="text-sm text-warm-white/60 mt-0.5">Here&apos;s what to do next.</p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-warm-white/40 hover:text-warm-white/80 transition-colors shrink-0 mt-0.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Action items */}
      <div className="flex flex-col sm:flex-row gap-2">
        {ACTIONS.map(action => (
          <Link
            key={action.href + action.label}
            href={action.href}
            className="flex-1 flex items-start gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3.5 transition-colors group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0 mt-1.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-warm-white group-hover:underline underline-offset-2">
                {action.label}
              </p>
              <p className="text-xs text-warm-white/50 mt-0.5">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
