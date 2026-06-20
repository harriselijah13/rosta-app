'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export type ScannedCard = {
  id: string
  name: string | null
  email: string | null
  company: string | null
  role: string | null
  phone: string | null
  met_at: string | null
  action_taken: 'pending' | 'connected' | 'invited'
  scanned_at: string
}

type Fields = {
  name: string
  email: string
  company: string
  role: string
  phone: string
  met_at: string
}

type ActionResult =
  | { kind: 'connected';         memberName: string; memberSlug: string }
  | { kind: 'already_connected'; memberName: string; memberSlug: string }
  | { kind: 'not_found' }
  | { kind: 'invited' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string }

type Phase = 'idle' | 'scanning' | 'confirm' | 'actioning' | 'done'

const FIELDS: { key: keyof Omit<Fields, 'met_at'>; label: string; placeholder: string }[] = [
  { key: 'name',    label: 'Name',    placeholder: 'Full name' },
  { key: 'email',   label: 'Email',   placeholder: 'email@example.com' },
  { key: 'company', label: 'Company', placeholder: 'Company name' },
  { key: 'role',    label: 'Role',    placeholder: 'Job title' },
  { key: 'phone',   label: 'Phone',   placeholder: 'Phone number' },
]

export default function ScanClient({ pastCards }: { pastCards: ScannedCard[] }) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [isMobile,    setIsMobile]    = useState(false)
  const [phase,       setPhase]       = useState<Phase>('idle')
  const [fields,      setFields]      = useState<Fields>({ name: '', email: '', company: '', role: '', phone: '', met_at: '' })
  const [savedCardId, setSavedCardId] = useState<string | null>(null)
  const [result,      setResult]      = useState<ActionResult | null>(null)
  const [history,     setHistory]     = useState<ScannedCard[]>(pastCards)
  const [scanError,   setScanError]   = useState<string | null>(null)
  const [metAtError,  setMetAtError]  = useState(false)

  useEffect(() => {
    setIsMobile(/Mobi|Android/i.test(navigator.userAgent))
  }, [])

  function prependHistory(action: ScannedCard['action_taken']) {
    setHistory(prev => [{
      id:           `local-${Date.now()}`,
      name:         fields.name    || null,
      email:        fields.email   || null,
      company:      fields.company || null,
      role:         fields.role    || null,
      phone:        fields.phone   || null,
      met_at:       fields.met_at  || null,
      action_taken: action,
      scanned_at:   new Date().toISOString(),
    }, ...prev])
  }

  function setField(key: keyof Fields) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFields(f => ({ ...f, [key]: e.target.value }))
      if (key === 'met_at') setMetAtError(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanError(null)
    setPhase('scanning')

    const base64   = await fileToBase64(file)
    const mimeType = file.type || 'image/jpeg'

    if (fileRef.current) fileRef.current.value = ''

    const res = await fetch('/api/scan-card', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ imageBase64: base64, mimeType }),
    })

    if (!res.ok) {
      // DIAGNOSTIC — remove once root cause is confirmed
      const errBody = await res.json().catch(() => null)
      console.error('[scan-card client] failed', { status: res.status, body: errBody, mimeType, base64Length: base64.length })
      setScanError('Could not read the card. Try a clearer photo.')
      setPhase('idle')
      return
    }

    const data = await res.json()
    setFields({
      name:    data.name    ?? '',
      email:   data.email   ?? '',
      company: data.company ?? '',
      role:    data.role    ?? '',
      phone:   data.phone   ?? '',
      met_at:  '',
    })
    setSavedCardId(null)
    setResult(null)
    setPhase('confirm')
  }

  async function handleConnect() {
    setPhase('actioning')
    const res = await fetch('/api/scan-card/connect', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...fields, cardId: savedCardId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setResult({ kind: 'error', message: data.error ?? 'Something went wrong' })
    } else if (!data.found) {
      setResult({ kind: 'not_found' })
    } else if (data.already_connected) {
      prependHistory('connected')
      setResult({ kind: 'already_connected', memberName: data.memberName, memberSlug: data.memberSlug })
    } else {
      prependHistory('connected')
      setResult({ kind: 'connected', memberName: data.memberName, memberSlug: data.memberSlug })
    }
    setPhase('done')
  }

  async function handleInvite() {
    if (!fields.met_at.trim()) { setMetAtError(true); return }
    setMetAtError(false)
    setPhase('actioning')
    const res = await fetch('/api/scan-card/invite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...fields, cardId: savedCardId }),
    })
    if (!res.ok) {
      const data = await res.json()
      setResult({ kind: 'error', message: data.error ?? 'Failed to send invite' })
    } else {
      prependHistory('invited')
      setResult({ kind: 'invited' })
    }
    setPhase('done')
  }

  async function handleSave() {
    if (!fields.met_at.trim()) { setMetAtError(true); return }
    setMetAtError(false)
    setPhase('actioning')
    const res = await fetch('/api/scan-card/save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...fields, action_taken: 'pending' }),
    })
    if (!res.ok) {
      setResult({ kind: 'error', message: 'Failed to save' })
    } else {
      const data = await res.json()
      setSavedCardId(data.cardId)
      prependHistory('pending')
      setResult({ kind: 'saved' })
    }
    setPhase('done')
  }

  function reset() {
    setPhase('idle')
    setResult(null)
    setSavedCardId(null)
    setScanError(null)
    setMetAtError(false)
  }

  const busy = phase === 'actioning'

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <h1 className="font-display text-2xl font-bold text-navy mb-1">Scan a card</h1>
      <p className="text-body-grey text-sm mb-8">
        Photograph a business card to extract contact details, then connect or invite.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFileChange}
      />

      {/* ── Idle ─────────────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div className="flex flex-col items-center py-16 border-2 border-dashed border-border rounded-2xl gap-4">
          {scanError && <p className="text-red-500 text-sm">{scanError}</p>}
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2.5 bg-navy text-warm-white px-7 py-3.5 rounded-full font-semibold text-sm hover:bg-navy/90 transition-colors"
          >
            <CameraIcon />
            {isMobile ? 'Take a photo' : 'Upload a photo'}
          </button>
          <p className="text-xs text-body-grey">
            {isMobile
              ? 'Point your camera at the card.'
              : 'Select an image of the business card from your device.'}
          </p>
        </div>
      )}

      {/* ── Scanning ──────────────────────────────────────────────────────── */}
      {phase === 'scanning' && (
        <div className="flex flex-col items-center py-20 gap-5">
          <div className="w-10 h-10 border-4 border-navy border-t-lime rounded-full animate-spin" />
          <p className="text-body-grey text-sm">Reading card…</p>
        </div>
      )}

      {/* ── Confirm / actioning ───────────────────────────────────────────── */}
      {(phase === 'confirm' || phase === 'actioning') && (
        <div className="space-y-4">
          <p className="text-sm text-body-grey -mt-2 mb-2">Review the extracted details and add where you met.</p>

          {FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-navy mb-1">{label}</label>
              <input
                type={key === 'email' ? 'email' : 'text'}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-navy bg-white placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40"
                value={fields[key]}
                placeholder={placeholder}
                onChange={setField(key)}
                disabled={busy}
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-navy mb-1">
              Where did you meet?
            </label>
            <input
              className={`w-full border rounded-xl px-4 py-2.5 text-sm text-navy bg-white placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 transition-colors ${
                metAtError ? 'border-red-400' : 'border-border'
              }`}
              value={fields.met_at}
              placeholder="e.g. Web Summit, Dubai · March 2026"
              onChange={setField('met_at')}
              disabled={busy}
            />
            {metAtError && (
              <p className="text-xs text-red-500 mt-1">Required for invite and save</p>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              disabled={busy || !fields.email.trim()}
              onClick={handleConnect}
              className="w-full bg-navy text-warm-white py-3 rounded-full font-semibold text-sm hover:bg-navy/90 transition-colors disabled:opacity-40"
            >
              {busy ? 'Working…' : 'Connect on ROSTA'}
            </button>
            <button
              disabled={busy || !fields.email.trim()}
              onClick={handleInvite}
              className="w-full border border-navy text-navy py-3 rounded-full font-semibold text-sm hover:bg-navy hover:text-warm-white transition-colors disabled:opacity-40"
            >
              Invite to ROSTA
            </button>
            <button
              disabled={busy}
              onClick={handleSave}
              className="text-sm text-body-grey hover:text-navy transition-colors py-1"
            >
              Save for later
            </button>
          </div>
        </div>
      )}

      {/* ── Done ──────────────────────────────────────────────────────────── */}
      {phase === 'done' && result && (
        <div className="text-center py-12 space-y-3">
          {result.kind === 'connected' && (
            <>
              <CheckCircle />
              <p className="font-display font-bold text-navy text-xl">Connected!</p>
              <p className="text-body-grey text-sm">
                You&apos;re now connected with {result.memberName} on ROSTA.
              </p>
              <Link
                href={`/profile/${result.memberSlug}`}
                className="inline-block mt-1 text-sm text-navy underline"
              >
                View {result.memberName}&apos;s profile
              </Link>
            </>
          )}

          {result.kind === 'already_connected' && (
            <>
              <p className="font-display font-bold text-navy text-xl">Already connected</p>
              <p className="text-body-grey text-sm">
                You&apos;re already connected with {result.memberName}.
              </p>
              <Link
                href={`/profile/${result.memberSlug}`}
                className="inline-block mt-1 text-sm text-navy underline"
              >
                View their profile
              </Link>
            </>
          )}

          {result.kind === 'not_found' && (
            <>
              <p className="font-display font-bold text-navy text-xl">Not on ROSTA yet</p>
              <p className="text-body-grey text-sm">
                That email isn&apos;t in the network. Want to invite them?
              </p>
              <button
                onClick={() => { setPhase('confirm'); setResult(null) }}
                className="mt-2 border border-navy text-navy px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-navy hover:text-warm-white transition-colors"
              >
                Send an invite
              </button>
            </>
          )}

          {result.kind === 'invited' && (
            <>
              <CheckCircle />
              <p className="font-display font-bold text-navy text-xl">Invite sent</p>
              <p className="text-body-grey text-sm">They&apos;ll get an email to join ROSTA.</p>
            </>
          )}

          {result.kind === 'saved' && (
            <>
              <p className="font-display font-bold text-navy text-xl">Saved</p>
              <p className="text-body-grey text-sm">
                You can connect or invite from your scan history.
              </p>
            </>
          )}

          {result.kind === 'error' && (
            <p className="text-red-500 text-sm">{result.message}</p>
          )}

          <div className="pt-4">
            <button
              onClick={reset}
              className="bg-navy text-warm-white px-7 py-3 rounded-full font-semibold text-sm hover:bg-navy/90 transition-colors"
            >
              Scan another card
            </button>
          </div>
        </div>
      )}

      {/* ── History ───────────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-lg font-bold text-navy mb-4">Previously scanned</h2>
          <ul className="space-y-3">
            {history.map(card => (
              <li key={card.id} className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy text-sm truncate">{card.name ?? '—'}</p>
                    {(card.company || card.role) && (
                      <p className="text-xs text-body-grey truncate">
                        {[card.company, card.role].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {card.email && (
                      <p className="text-xs text-body-grey truncate">{card.email}</p>
                    )}
                    {card.met_at && (
                      <p className="text-xs text-body-grey mt-0.5">Met at: {card.met_at}</p>
                    )}
                  </div>
                  <ActionBadge action={card.action_taken} />
                </div>
                <p className="text-xs text-body-grey mt-2">{formatDate(card.scanned_at)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ActionBadge({ action }: { action: ScannedCard['action_taken'] }) {
  if (action === 'connected')
    return <span className="shrink-0 text-[10px] font-semibold bg-lime text-navy px-2 py-0.5 rounded-full">Connected</span>
  if (action === 'invited')
    return <span className="shrink-0 text-[10px] font-semibold bg-navy/10 text-navy px-2 py-0.5 rounded-full">Invited</span>
  return <span className="shrink-0 text-[10px] font-semibold border border-border text-body-grey px-2 py-0.5 rounded-full">Saved</span>
}

function CheckCircle() {
  return (
    <div className="w-14 h-14 rounded-full bg-lime flex items-center justify-center mx-auto">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F1B3C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
