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
  const [toast, setToast] = useState<string | null>(null)

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
        // user cancelled — no toast needed
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
      // fallback: select the textarea
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

export default function InviteClient({ codes, availableCount, redeemedCount, memberFirstName }: Props) {
  const [shareCode, setShareCode] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const available = codes.filter(c => !c.used_at)
  const used      = codes.filter(c => c.used_at)

  async function copyCode(token: string) {
    await navigator.clipboard.writeText(token)
    setCopiedCode(token)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <>
      {shareCode && (
        <ShareModal
          code={shareCode}
          memberFirstName={memberFirstName}
          onClose={() => setShareCode(null)}
        />
      )}

      {availableCount > 0 ? (
        <p className="text-sm text-body-grey mb-6">
          You have {availableCount} invite {availableCount === 1 ? 'code' : 'codes'} available.
        </p>
      ) : (
        <p className="text-sm text-body-grey mb-6">You have no invite codes available right now.</p>
      )}

      {codes.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-8">
          <p className="text-sm text-navy leading-relaxed">
            You don&apos;t have any invite codes right now. New codes are awarded as you contribute to the network — make a warm intro, reach a new Connector milestone, or help an Open Table conversation along.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {available.map(code => (
            <div key={code.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <span className="font-mono text-sm font-semibold tracking-widest text-navy">
                {code.token}
              </span>
              <div className="flex items-center gap-4 shrink-0">
                <button
                  onClick={() => setShareCode(code.token)}
                  className="text-sm font-medium bg-navy text-warm-white px-4 py-1.5 rounded-full hover:bg-navy/90 transition-colors"
                >
                  Share invite
                </button>
                <button
                  onClick={() => copyCode(code.token)}
                  className="text-xs text-body-grey/60 hover:text-body-grey transition-colors"
                >
                  {copiedCode === code.token ? 'Copied' : 'Copy code only'}
                </button>
              </div>
            </div>
          ))}
          {used.map(code => (
            <div key={code.id} className="flex items-center justify-between gap-4 px-5 py-4 bg-surface">
              <span className="font-mono text-sm font-semibold tracking-widest text-body-grey line-through">
                {code.token}
              </span>
              <span className="text-xs text-body-grey shrink-0">
                Used{code.usedByName ? ` by ${code.usedByName}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {redeemedCount > 0 && (
        <p className="text-xs mt-6" style={{ color: 'rgba(15,27,60,0.50)' }}>
          Your invites have led to {redeemedCount} {redeemedCount === 1 ? 'member' : 'members'} joining ROSTA.
        </p>
      )}
    </>
  )
}
