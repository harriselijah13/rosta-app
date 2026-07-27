'use client'

import { useState, useEffect } from 'react'

type Props = {
  userId:       string
  firstName:    string
  referralCount: number
}

export default function InviteClient({ userId, firstName, referralCount }: Props) {
  const link    = `https://onrosta.com/?ref=${userId}`
  const message =
    `${firstName || 'A ROSTA member'} thinks you'd fit in on ROSTA — a professional ` +
    `network built around real introductions and real conversations. No feed. No cold connects.\n\n` +
    `Join here: ${link}`

  const [copied,       setCopied]       = useState(false)
  const [showMessages, setShowMessages] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    setShowMessages(/iP(hone|od|ad)/i.test(ua) || /Android/i.test(ua))
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-16">

      {/* Hero */}
      <div className="bg-navy rounded-[20px] px-8 sm:px-12 py-14 sm:py-16 text-center mb-10">
        <p className="font-display font-medium italic mb-4" style={{ fontSize: 14, color: 'rgba(245,242,238,0.65)' }}>
          Your invite link
        </p>
        <h1
          className="font-display font-black text-warm-white leading-tight mb-3"
          style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)' }}
        >
          {referralCount > 0
            ? `${referralCount} ${referralCount === 1 ? 'person' : 'people'} joined through your link.`
            : 'Bring people you trust in.'}
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(245,242,238,0.55)' }}>
          Everyone who signs up via your link is credited to you.
        </p>
      </div>

      {/* Link card */}
      <div className="bg-white border border-border rounded-2xl shadow-[0_4px_16px_rgba(15,27,60,0.06)] p-6 mb-6">
        <p className="text-xs font-semibold tracking-widest text-body-grey uppercase mb-2">
          Your link
        </p>
        <p className="font-mono text-sm text-navy mb-5 break-all">{link}</p>

        {/* Share channels */}
        <div className="flex flex-wrap gap-2 mb-4">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-1.5 bg-navy text-warm-white text-sm font-medium rounded-full hover:bg-navy/90 transition-colors whitespace-nowrap"
          >
            WhatsApp
          </a>
          {showMessages && (
            <a
              href={`sms:?body=${encodeURIComponent(message)}`}
              className="inline-flex items-center px-4 py-1.5 bg-navy text-warm-white text-sm font-medium rounded-full hover:bg-navy/90 transition-colors whitespace-nowrap"
            >
              Messages
            </a>
          )}
          <a
            href={`mailto:?subject=${encodeURIComponent('Join me on ROSTA')}&body=${encodeURIComponent(message)}`}
            className="inline-flex items-center px-4 py-1.5 bg-navy text-warm-white text-sm font-medium rounded-full hover:bg-navy/90 transition-colors whitespace-nowrap"
          >
            Email
          </a>
        </div>

        <button
          onClick={handleCopy}
          className="w-full py-3 bg-lime text-navy font-semibold text-sm rounded-full hover:bg-lime/90 transition-colors"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      {/* How it works */}
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(15,27,60,0.55)' }}>
        Anyone who joins through your link is recorded as your referral and adds 5 points
        to your Connector Score. Your link is permanent and does not expire.
      </p>

    </div>
  )
}
