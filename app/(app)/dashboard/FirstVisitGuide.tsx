'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  step1Complete: boolean
  step2Complete: boolean
  step3Complete: boolean
  step4Complete: boolean
  dismissed: boolean
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

const STEPS = [
  {
    title: 'Update your signals.',
    description: "Let your network know what you're working on right now.",
    href: '/settings#signals',
    hasCta: true,
  },
  {
    title: 'Browse members.',
    description: "See who's already in your reach.",
    href: '/members',
    hasCta: true,
  },
  {
    title: 'Suggest an intro.',
    description: 'Introduce two people who should meet.',
    href: '/intro/suggest',
    hasCta: true,
  },
  {
    title: 'Wait for a warm intro.',
    description: "The platform works best when you're patient.",
    href: null,
    hasCta: false,
  },
]

export default function FirstVisitGuide({
  step1Complete,
  step2Complete,
  step3Complete,
  step4Complete,
  dismissed,
}: Props) {
  const [isDismissed, setIsDismissed] = useState(dismissed)

  const completions = [step1Complete, step2Complete, step3Complete, step4Complete]
  const allComplete = completions.every(Boolean)
  const nextUpIndex = completions.findIndex(c => !c)

  if (isDismissed) return null

  function dismiss() {
    setIsDismissed(true)
    fetch('/api/profile/first-visit-guide-dismiss', { method: 'POST' }).catch(() => {})
  }

  if (allComplete) {
    return (
      <div className="bg-navy rounded-2xl px-6 py-5 mb-8 flex items-center justify-between gap-4">
        <p className="font-display text-lg font-black text-warm-white">
          You&apos;re ready. The network&apos;s yours.
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-warm-white/40 hover:text-warm-white/80 transition-colors shrink-0"
        >
          <XIcon />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-navy rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="font-display text-xl font-black text-warm-white leading-tight">
          Get the most from ROSTA.
        </h2>
        <button
          onClick={dismiss}
          aria-label="Dismiss guide"
          className="text-warm-white/40 hover:text-warm-white/80 transition-colors shrink-0 mt-0.5"
        >
          <XIcon />
        </button>
      </div>
      <p className="text-sm text-warm-white/70 mb-6">Four small actions in your first week.</p>

      <div className="flex flex-col gap-4">
        {STEPS.map((step, i) => {
          const complete = completions[i]
          const isNextUp = !complete && i === nextUpIndex

          return (
            <div
              key={i}
              className={`flex items-center gap-4 transition-opacity ${complete ? 'opacity-50' : ''}`}
            >
              <div className="w-7 h-7 rounded-full bg-white/10 shrink-0 flex items-center justify-center">
                {complete
                  ? <span className="text-warm-white"><CheckIcon /></span>
                  : <span className="text-xs font-semibold text-warm-white/80">{i + 1}</span>
                }
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-warm-white leading-tight">{step.title}</p>
                <p className="text-xs text-warm-white/70 mt-0.5">{step.description}</p>
              </div>

              {isNextUp && step.hasCta && step.href && (
                <Link
                  href={step.href}
                  className="shrink-0 px-4 py-1.5 bg-lime text-navy text-xs font-semibold rounded-full hover:bg-lime/90 transition-colors whitespace-nowrap"
                >
                  Do it
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
