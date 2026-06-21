'use client'

import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type InviteCode = { id: string; token: string }

type CapturedRow = {
  id: string
  name: string
  context: string
  channel: 'WhatsApp' | 'Messages' | 'Email' | 'Other'
}

type Props = {
  attendanceId: string
  availableCodes: InviteCode[]
}

// ── Ambient drift dots (same pattern as /invite hero) ────────────────────────

type DotConfig = { style: CSSProperties; dur: string; delay: string }

const DRIFT_DOTS: DotConfig[] = [
  { style: { top: '12%', left: '6%'    }, dur: '5.2s', delay: '0s'   },
  { style: { top: '18%', right: '10%'  }, dur: '6.1s', delay: '1.3s' },
  { style: { top: '55%', left: '4%'    }, dur: '4.8s', delay: '2.7s' },
  { style: { top: '40%', right: '6%'   }, dur: '5.5s', delay: '0.6s' },
  { style: { top: '70%', left: '18%'   }, dur: '7.0s', delay: '3.4s' },
  { style: { bottom: '15%', right: '14%' }, dur: '5.8s', delay: '1.8s' },
]

// ── Channel deep-link helpers (mirrors InviteClient logic) ───────────────────

const CHANNEL_OPTIONS = ['WhatsApp', 'Messages', 'Email', 'Other'] as const

function channelHref(channel: string, message: string): string | null {
  switch (channel) {
    case 'WhatsApp': return `https://wa.me/?text=${encodeURIComponent(message)}`
    case 'Messages': return `sms:?body=${encodeURIComponent(message)}`
    case 'Email':    return `mailto:?subject=${encodeURIComponent("You're invited to ROSTA")}&body=${encodeURIComponent(message)}`
    default:         return null
  }
}

function buildMessage(name: string, context: string, code: string): string {
  const contextLine = context.trim()
    ? `\nWe’d talked about ${context.trim()} — feels like the kind of conversation that’d be useful to keep going here too.`
    : ''
  return `Hey ${name} — great chat yesterday. I thought you’d find ROSTA worth a look — it’s a small professional network built around real introductions. No feed, no cold connects.

Your invite code: ${code}
Join here: https://app.onrosta.com/join?code=${code}${contextLine}`
}

function newRow(): CapturedRow {
  return { id: Math.random().toString(36).slice(2), name: '', context: '', channel: 'WhatsApp' }
}

// ── Capture modal ─────────────────────────────────────────────────────────────

function CaptureModal({
  availableCodes,
  onComplete,
  onClose,
}: {
  availableCodes: InviteCode[]
  onComplete: () => void
  onClose: () => void
}) {
  const [phase,         setPhase]         = useState<'capture' | 'send' | 'done' | 'out-of-codes'>('capture')
  const [rows,          setRows]          = useState<CapturedRow[]>([newRow()])
  const [names,         setNames]         = useState<CapturedRow[]>([])
  const [sendIndex,     setSendIndex]     = useState(0)
  const [sentCount,     setSentCount]     = useState(0)
  const [editedMessage, setEditedMessage] = useState('')
  const [toast,         setToast]         = useState<string | null>(null)
  const [showMessages,  setShowMessages]  = useState(false)
  const [completing,    setCompleting]    = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    setShowMessages(/iP(hone|od|ad)/i.test(ua) || /Mac OS X/i.test(ua) || /Android/i.test(ua))
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Capture phase helpers ──
  function updateRow(id: string, field: keyof CapturedRow, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  function removeRow(id: string) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev)
  }
  function addRow() {
    if (rows.length >= 5) return
    setRows(prev => [...prev, newRow()])
  }

  const validRows = rows.filter(r => r.name.trim())

  function handleContinue() {
    const captured = validRows
    setNames(captured)
    setSendIndex(0)
    setSentCount(0)
    const firstCode = availableCodes[0]
    if (!firstCode) { setPhase('out-of-codes'); return }
    setEditedMessage(buildMessage(captured[0].name, captured[0].context, firstCode.token))
    setPhase('send')
  }

  // ── Send phase helpers ──
  const currentName = names[sendIndex]
  const currentCode = availableCodes[sentCount]

  function advanceSend(consumed: boolean) {
    const nextSentCount = consumed ? sentCount + 1 : sentCount
    const nextIndex     = sendIndex + 1

    if (nextIndex >= names.length) {
      // All names processed
      setCompleting(true)
      fetch('/api/event/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceId: '' }), // attendanceId passed via onComplete closure
      }).catch(() => {})
      onComplete()
      setPhase('done')
      return
    }

    // Check if there will be a code for the next send
    const nextCode = availableCodes[nextSentCount]
    if (!nextCode && nextIndex < names.length) {
      // No codes left for remaining names
      setPhase('out-of-codes')
      return
    }

    setSentCount(nextSentCount)
    setSendIndex(nextIndex)
    const next = names[nextIndex]
    setEditedMessage(buildMessage(next.name, next.context, availableCodes[nextSentCount]?.token ?? ''))
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(editedMessage)
      showToast('Copied.')
      advanceSend(true)
    } catch {
      showToast('Select and copy the text above.')
    }
  }

  // ── Render ──

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(15,27,60,0.6)' }}
      onClick={phase === 'capture' ? onClose : undefined}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Capture phase ── */}
        {phase === 'capture' && (
          <div className="p-7">
            <h2 className="font-display text-2xl font-black text-navy mb-1">Capture names</h2>
            <p className="text-sm text-body-grey mb-6">
              Add anyone you met. We&apos;ll help you reach out to each one in their preferred channel.
            </p>

            <div className="space-y-4">
              {rows.map((row, i) => (
                <div key={row.id} className="space-y-2 pb-4 border-b border-border last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-body-grey uppercase tracking-wide flex-1">
                      Person {i + 1}
                    </p>
                    {rows.length > 1 && (
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-body-grey/40 hover:text-navy transition-colors"
                        aria-label="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={row.name}
                    onChange={e => updateRow(row.id, 'name', e.target.value)}
                    placeholder="Marcus Chen"
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:border-navy transition-colors"
                  />
                  <input
                    type="text"
                    value={row.context}
                    onChange={e => updateRow(row.id, 'context', e.target.value.slice(0, 120))}
                    placeholder="Talked about logistics for SE Asia expansion"
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:border-navy transition-colors"
                  />
                  <select
                    value={row.channel}
                    onChange={e => updateRow(row.id, 'channel', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl text-navy bg-white focus:outline-none focus:border-navy transition-colors"
                  >
                    {CHANNEL_OPTIONS.filter(c => c !== 'Messages' || showMessages).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {rows.length < 5 ? (
              <button
                onClick={addRow}
                className="mt-4 text-sm font-medium transition-colors"
                style={{ color: 'rgba(15,27,60,0.65)' }}
              >
                + Add another
              </button>
            ) : (
              <p className="mt-4 text-xs text-body-grey">Capture up to 5 at a time.</p>
            )}

            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={handleContinue}
                disabled={validRows.length === 0}
                className="w-full py-3 bg-lime text-navy font-semibold text-sm rounded-full hover:bg-lime/90 transition-colors disabled:opacity-40"
              >
                Continue
              </button>
              <button
                onClick={onClose}
                className="text-sm text-body-grey hover:text-navy transition-colors py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Send phase ── */}
        {phase === 'send' && currentName && currentCode && (
          <div className="p-7">
            <p className="text-xs font-semibold text-body-grey uppercase tracking-wide mb-1">
              {sendIndex + 1} of {names.length}
            </p>
            <h2 className="font-display text-2xl font-black text-navy mb-1">
              Invite {currentName.name}
            </h2>
            <p className="text-sm text-body-grey mb-4">
              Edit if you want, then send through {currentName.channel}.
            </p>

            <textarea
              value={editedMessage}
              onChange={e => setEditedMessage(e.target.value)}
              rows={8}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm text-navy bg-surface focus:outline-none focus:border-navy resize-none mb-5 leading-relaxed"
            />

            <div className="flex flex-col gap-3">
              {currentName.channel !== 'Other' ? (
                <a
                  href={channelHref(currentName.channel, editedMessage) ?? '#'}
                  target={currentName.channel === 'WhatsApp' ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  onClick={() => advanceSend(true)}
                  className="w-full py-3 bg-lime text-navy font-semibold text-sm rounded-full hover:bg-lime/90 transition-colors text-center block"
                >
                  Send via {currentName.channel}
                </a>
              ) : (
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ text: editedMessage }).catch(() => {})
                    }
                    advanceSend(true)
                  }}
                  className="w-full py-3 bg-lime text-navy font-semibold text-sm rounded-full hover:bg-lime/90 transition-colors"
                >
                  Share
                </button>
              )}
              <button
                onClick={handleCopy}
                className="w-full py-3 bg-navy text-warm-white font-semibold text-sm rounded-full hover:bg-navy/90 transition-colors"
              >
                Copy message
              </button>
              <button
                onClick={() => advanceSend(false)}
                className="text-sm py-1 transition-colors"
                style={{ color: 'rgba(245,242,238,0)' }}
              >
                {/* invisible spacer — real Skip below */}
              </button>
              <button
                onClick={() => advanceSend(false)}
                className="text-sm text-body-grey hover:text-navy transition-colors py-1"
              >
                Skip this one
              </button>
            </div>
          </div>
        )}

        {/* ── Out of codes ── */}
        {phase === 'out-of-codes' && (
          <div className="p-7 text-center">
            <h2 className="font-display text-xl font-bold text-navy mb-3">
              You&apos;ve used all your codes.
            </h2>
            <p className="text-sm text-body-grey mb-6">
              Capture the rest of the names for later — we&apos;ll prompt you when you have more codes.
            </p>
            <button
              onClick={() => { onComplete(); setPhase('done') }}
              className="text-sm font-medium text-navy hover:underline underline-offset-2"
            >
              Back to dashboard
            </button>
          </div>
        )}

        {/* ── Done ── */}
        {phase === 'done' && (
          <div className="p-7 text-center">
            <h2 className="font-display text-xl font-bold text-navy mb-3">Done.</h2>
            <p className="text-sm text-body-grey mb-6">
              Codes you used will be marked as sent when your contacts sign up.
            </p>
            <button
              onClick={onClose}
              className="text-sm font-medium text-navy hover:underline underline-offset-2"
            >
              Back to dashboard
            </button>
          </div>
        )}

      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-navy text-warm-white text-sm font-medium px-5 py-3 rounded-full shadow-lg whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}
      {completing && null}
    </div>
  )
}

// ── PostEventPrompt — hero block + modal trigger ──────────────────────────────

export default function PostEventPrompt({ attendanceId, availableCodes }: Props) {
  const [dismissed,  setDismissed]  = useState(false)
  const [showModal,  setShowModal]  = useState(false)
  const [completed,  setCompleted]  = useState(false)

  async function handleDismiss() {
    setDismissed(true)
    await fetch('/api/event/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceId }),
    }).catch(() => {})
  }

  async function handleComplete() {
    setCompleted(true)
    await fetch('/api/event/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceId }),
    }).catch(() => {})
  }

  if (dismissed || completed) return null

  return (
    <>
      {/* ── Navy hero block ── */}
      <div className="relative bg-navy rounded-[20px] overflow-hidden card-enter" style={{ animationDelay: '0s' }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none">
          {DRIFT_DOTS.map((dot, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="absolute rounded-full network-node"
              style={{
                ...dot.style,
                width: 3,
                height: 3,
                backgroundColor: 'rgba(245,242,238,0.06)',
                '--node-duration': dot.dur,
                '--node-delay':    dot.delay,
              } as CSSProperties}
            />
          ))}
        </div>

        <div className="relative z-10 px-8 sm:px-12 py-10 sm:py-12 text-center">
          <p
            className="font-display font-medium italic mb-3"
            style={{ fontSize: 14, color: 'rgba(245,242,238,0.65)' }}
          >
            Yesterday at the event
          </p>
          <h2
            className="font-display font-black text-warm-white leading-tight mb-2"
            style={{ fontSize: 'clamp(1.5rem, 4.5vw, 2.25rem)' }}
          >
            Anyone you&apos;d want on ROSTA?
          </h2>
          <p className="mb-7" style={{ fontSize: 15, color: 'rgba(245,242,238,0.55)' }}>
            Capture names while they&apos;re fresh. We&apos;ll help you reach out.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="px-7 py-3 bg-lime text-navy font-semibold text-sm rounded-full hover:bg-lime/90 transition-colors whitespace-nowrap"
            >
              Capture names
            </button>
            <button
              onClick={handleDismiss}
              className="text-sm transition-colors"
              style={{ color: 'rgba(245,242,238,0.55)' }}
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <CaptureModal
          availableCodes={availableCodes}
          onComplete={() => { handleComplete(); setShowModal(false) }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
