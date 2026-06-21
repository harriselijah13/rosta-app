'use client'

import { useState } from 'react'

type Code = {
  id: string
  token: string
  used_at: string | null
  usedByName: string | null
}

type Props = {
  codes: Code[]
  availableCount: number
  redeemedCount: number
  memberFirstName: string
}

// ── Drift dot config ──────────────────────────────────────────────────────────

type DotConfig = {
  style: React.CSSProperties
  dur: string
  delay: string
  desktopOnly?: boolean
}

const DRIFT_DOTS: DotConfig[] = [
  { style: { top: '12%',  left: '6%'   }, dur: '5.2s', delay: '0s'   },
  { style: { top: '18%',  right: '10%' }, dur: '6.1s', delay: '1.3s' },
  { style: { top: '55%',  left: '4%'   }, dur: '4.8s', delay: '2.7s' },
  { style: { top: '40%',  right: '6%'  }, dur: '5.5s', delay: '0.6s' },
  { style: { top: '70%',  left: '18%'  }, dur: '7.0s', delay: '3.4s', desktopOnly: true },
  { style: { bottom: '15%', right: '14%' }, dur: '5.8s', delay: '1.8s', desktopOnly: true },
  { style: { top: '70%',  left: '55%'  }, dur: '5.0s', delay: '2.2s', desktopOnly: true },
  { style: { top: '25%',  left: '42%'  }, dur: '6.3s', delay: '1.0s', desktopOnly: true },
  { style: { bottom: '35%', right: '30%' }, dur: '4.7s', delay: '3.8s', desktopOnly: true },
]

// ── Share modal (unchanged) ───────────────────────────────────────────────────

function ShareModal({
  code,
  memberFirstName,
  onClose,
}: {
  code: string
  memberFirstName: string
  onClose: () => void
}) {
  const defaultMessage = `${memberFirstName} thinks you'd fit in on ROSTA — a professional network built around real introductions and real conversations. No feed. No cold connects. Invite-only.

Your code: ${code}

Join here: https://app.onrosta.com/join?code=${code}`

  const [message, setMessage] = useState(defaultMessage)
  const [toast, setToast]     = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ text: message })
        showToast('Shared.')
        setTimeout(onClose, 400)
      } catch {
        // user cancelled
      }
    } else {
      await handleCopy()
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message)
      showToast('Copied.')
    } catch {
      const el = document.getElementById('invite-message-textarea') as HTMLTextAreaElement | null
      el?.select()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(15,27,60,0.6)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
      >
        <h2 className="font-display text-2xl font-black text-navy mb-1">
          Share your invite
        </h2>
        <p className="text-sm mb-5" style={{ color: 'rgba(15,27,60,0.65)' }}>
          Edit the message if you want. Then send it however you usually message people.
        </p>

        <textarea
          id="invite-message-textarea"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={7}
          className="w-full border border-border rounded-xl px-4 py-3 text-sm text-navy bg-surface focus:outline-none focus:border-navy resize-none mb-5 leading-relaxed"
        />

        <div className="flex flex-col gap-3">
          <button
            onClick={handleShare}
            className="w-full py-3 bg-lime text-navy font-semibold text-sm rounded-full hover:bg-lime/90 transition-colors"
          >
            Share
          </button>
          <button
            onClick={handleCopy}
            className="w-full py-3 bg-navy text-warm-white font-semibold text-sm rounded-full hover:bg-navy/90 transition-colors"
          >
            Copy message
          </button>
          <button
            onClick={onClose}
            className="text-sm text-body-grey hover:text-navy transition-colors py-1"
          >
            Cancel
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-navy text-warm-white text-sm font-medium px-5 py-3 rounded-full shadow-lg whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── How it works expandable ───────────────────────────────────────────────────

function HowItWorks() {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm font-medium transition-colors"
        style={{ color: 'rgba(15,27,60,0.70)' }}
      >
        <span>How invite codes work</span>
        <svg
          className="w-4 h-4 transition-transform duration-200"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(15,27,60,0.70)' }}>
            Each code can be used once. When someone joins with your code, you&apos;re
            credited as their inviter.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(15,27,60,0.70)' }}>
            New codes are awarded as you contribute to the network — make a warm intro,
            reach a Connector milestone, or help an Open Table conversation along.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(15,27,60,0.70)' }}>
            Codes don&apos;t expire.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InviteClient({ codes, availableCount, redeemedCount, memberFirstName }: Props) {
  const [shareCode,  setShareCode]  = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const available = codes.filter(c => !c.used_at)
  const used      = codes.filter(c => c.used_at)
  const hasAny    = codes.length > 0

  async function copyCode(token: string) {
    await navigator.clipboard.writeText(token)
    setCopiedCode(token)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const heroHeadline = availableCount > 0
    ? `You have ${availableCount} invite ${availableCount === 1 ? 'code' : 'codes'}.`
    : 'No invite codes right now.'

  const heroSubhead = availableCount > 0
    ? 'Bring people you trust into your network.'
    : 'New codes are awarded as you contribute to the network.'

  return (
    <>
      {shareCode && (
        <ShareModal
          code={shareCode}
          memberFirstName={memberFirstName}
          onClose={() => setShareCode(null)}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-16">

        {/* ── Section 1: Navy hero block ── */}
        <div className="relative bg-navy rounded-[20px] overflow-hidden mb-12">

          {/* Ambient drift dots */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none">
            {DRIFT_DOTS.map((dot, i) => (
              <div
                key={i}
                aria-hidden="true"
                className={`absolute rounded-full network-node${dot.desktopOnly ? ' hidden sm:block' : ''}`}
                style={{
                  ...dot.style,
                  width: 3,
                  height: 3,
                  backgroundColor: 'rgba(245,242,238,0.06)',
                  '--node-duration': dot.dur,
                  '--node-delay':    dot.delay,
                } as React.CSSProperties}
              />
            ))}
          </div>

          <div className="relative z-10 px-8 sm:px-12 py-14 sm:py-16 text-center">
            <p
              className="font-display font-medium italic mb-4"
              style={{ fontSize: 14, color: 'rgba(245,242,238,0.65)' }}
            >
              Invite
            </p>
            <h1
              className="font-display font-black text-warm-white leading-tight mb-3"
              style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)' }}
            >
              {heroHeadline}
            </h1>
            <p style={{ fontSize: 16, color: 'rgba(245,242,238,0.55)' }}>
              {heroSubhead}
            </p>
          </div>
        </div>

        {/* ── Section 2: Codes card ── */}
        {hasAny ? (
          <div className="bg-white border border-border rounded-2xl shadow-[0_4px_16px_rgba(15,27,60,0.06)] overflow-hidden">

            {available.map((code, i) => (
              <div
                key={code.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-[#F7F5F2] transition-colors${
                  i < available.length - 1 || used.length > 0 ? ' border-b border-[#E5E1DB]' : ''
                }`}
              >
                <span className="font-mono text-base font-semibold tracking-widest text-navy">
                  {code.token}
                </span>
                <div className="flex items-center gap-4 sm:ml-auto shrink-0">
                  <button
                    onClick={() => setShareCode(code.token)}
                    className="text-sm font-medium bg-navy text-warm-white px-4 py-1.5 rounded-full hover:bg-navy/90 transition-colors whitespace-nowrap"
                  >
                    Share invite
                  </button>
                  <button
                    onClick={() => copyCode(code.token)}
                    className="text-xs font-medium whitespace-nowrap transition-colors"
                    style={{
                      color: copiedCode === code.token
                        ? 'rgba(15,27,60,0.85)'
                        : 'rgba(15,27,60,0.45)',
                    }}
                  >
                    {copiedCode === code.token ? 'Copied' : 'Copy code only'}
                  </button>
                </div>
              </div>
            ))}

            {used.map((code, i) => (
              <div
                key={code.id}
                className={`flex items-center justify-between gap-4 px-5 py-4 bg-surface${
                  i < used.length - 1 ? ' border-b border-[#E5E1DB]' : ''
                }`}
              >
                <span className="font-mono text-base font-semibold tracking-widest text-body-grey line-through">
                  {code.token}
                </span>
                <span className="text-xs text-body-grey shrink-0">
                  Used{code.usedByName ? ` by ${code.usedByName}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          /* Empty state — no card, plain centred text */
          <p
            className="text-center leading-relaxed px-4"
            style={{ fontSize: 16, color: 'rgba(15,27,60,0.55)' }}
          >
            Make a warm intro, reach a Connector milestone, or help an Open Table
            conversation along, and a new code will be ready for you here.
          </p>
        )}

        {/* ── Section 3: Impact line + how it works ── */}
        <div className="mt-8 space-y-6">
          {redeemedCount > 0 && (
            <p
              className="text-sm text-center"
              style={{ color: 'rgba(15,27,60,0.45)' }}
            >
              Your invites have led to {redeemedCount} {redeemedCount === 1 ? 'member' : 'members'} joining ROSTA.
            </p>
          )}

          <HowItWorks />
        </div>

      </div>
    </>
  )
}
