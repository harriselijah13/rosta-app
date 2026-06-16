'use client'

import { useState } from 'react'

type InviteCode = {
  id: string
  token: string
  used_at: string | null
  reserved_for_email: string | null
}

export default function InvitePanel({ codes }: { codes: InviteCode[] }) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (codes.length === 0) return null

  const selected = codes.find(c => c.id === selectedId)

  function selectCode(code: InviteCode) {
    if (code.used_at || code.reserved_for_email) return
    setSelectedId(code.id)
    setError(null)
    setSentTo(null)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || !recipientEmail) return
    setSending(true)
    setError(null)

    const res = await fetch('/api/invite/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codeId: selectedId,
        recipientEmail,
        recipientName: recipientName || undefined,
        note: note || undefined,
      }),
    })

    const data = await res.json()
    setSending(false)

    if (!res.ok || !data.ok) {
      setError(data.error || 'Something went wrong. Please try again.')
      return
    }

    setSentTo(recipientEmail)
    setSelectedId(null)
    setRecipientName('')
    setRecipientEmail('')
    setNote('')
  }

  return (
    <div className="mb-8">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-navy border border-border px-4 py-2 rounded-full hover:border-navy transition-colors"
        >
          Invite someone to ROSTA
        </button>
      ) : (
        <div className="bg-white border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-bold text-navy">Invite someone to ROSTA</h2>
            <button
              onClick={() => { setOpen(false); setSentTo(null); setSelectedId(null); setError(null) }}
              className="text-body-grey hover:text-navy transition-colors text-sm"
            >
              Close
            </button>
          </div>

          {sentTo && (
            <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
              Invite sent to {sentTo}.
            </div>
          )}

          <p className="text-xs text-body-grey mb-3">Select an invite code to send:</p>

          {/* Code pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {codes.map(code => {
              const isUsed = !!code.used_at
              const isSent = !isUsed && !!code.reserved_for_email
              const isAvailable = !isUsed && !isSent
              const isSelected = selectedId === code.id

              return (
                <button
                  key={code.id}
                  onClick={() => selectCode(code)}
                  disabled={!isAvailable}
                  className={[
                    'flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-all',
                    isSelected
                      ? 'border-lime bg-lime/20'
                      : isAvailable
                        ? 'border-border hover:border-navy cursor-pointer'
                        : 'border-border bg-surface cursor-not-allowed opacity-60',
                  ].join(' ')}
                >
                  <span className={`font-mono text-sm font-semibold tracking-widest ${isUsed ? 'line-through text-body-grey' : 'text-navy'}`}>
                    {code.token}
                  </span>
                  <span className="text-[10px] text-body-grey mt-0.5">
                    {isUsed ? 'Used · 1 used' : isSent ? `Sent · 0 used` : 'Unused · 0 used'}
                  </span>
                  {isSent && code.reserved_for_email && (
                    <span className="text-[10px] text-body-grey truncate max-w-[120px]">{code.reserved_for_email}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Form — shown only once a code is selected */}
          {selected && (
            <form onSubmit={handleSend} className="space-y-3 pt-3 border-t border-border">
              <div>
                <label className="block text-xs font-medium text-navy mb-1">Recipient name <span className="text-body-grey font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="Their first name"
                  className="w-full px-3 py-2 text-sm border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-navy mb-1">Recipient email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  placeholder="their@email.com"
                  required
                  className="w-full px-3 py-2 text-sm border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Personal note <span className="text-body-grey font-normal">(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value.slice(0, 200))}
                  placeholder="Add a personal note — why should they join?"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors resize-none"
                />
                <p className="text-[10px] text-body-grey text-right mt-0.5">{note.length}/200</p>
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
              )}

              <button
                type="submit"
                disabled={sending || !recipientEmail}
                className="w-full py-2.5 text-sm font-semibold bg-navy text-warm-white rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send invite'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
