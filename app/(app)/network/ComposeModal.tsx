'use client'

import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import type { FeedPost } from './feedUtils'

function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, '').replace(/\s{2,}/g, ' ').trim()
}

type Step = 'pick' | 'form'
type PostType = 'ask' | 'offer'

type Props = {
  onClose: () => void
  onCreated: (post: FeedPost) => void
  currentUserId: string
  currentUserName: string
  currentUserAvatarUrl: string | null
  currentUserIsVerified: boolean
  currentUserUsername: string | null
  initialType?: 'ask' | 'offer'
}

export default function ComposeModal({
  onClose, onCreated,
  currentUserId, currentUserName, currentUserAvatarUrl, currentUserIsVerified, currentUserUsername,
  initialType,
}: Props) {
  const [step, setStep]       = useState<Step>(initialType ? 'form' : 'pick')
  const [postType, setPostType] = useState<PostType>(initialType ?? 'ask')
  const [f1, setF1]           = useState('')
  const [f2, setF2]           = useState('')
  const [f3, setF3]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState('')

  const F3_MAX = postType === 'ask' ? 140 : 80

  // ESC closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function pick(type: PostType) {
    setPostType(type)
    setF1(''); setF2(''); setF3(''); setError('')
    setStep('form')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    const clean1 = stripUrls(f1).slice(0, 80)
    const clean2 = stripUrls(f2).slice(0, 240)
    const clean3 = stripUrls(f3).slice(0, F3_MAX)
    if (!clean1 || !clean2 || !clean3) {
      setError('All fields are required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/network/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_type: postType, field_1: clean1, field_2: clean2, field_3: clean3 }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Something went wrong.')
      }
      const raw = await res.json()
      const expiryDays = postType === 'ask' ? 7 : 14
      const post: FeedPost = {
        kind:               'post',
        id:                 raw.id,
        authorId:           currentUserId,
        authorName:         currentUserName,
        authorAvatarUrl:    currentUserAvatarUrl,
        authorUsername:     currentUserUsername,
        authorIsVerified:   currentUserIsVerified,
        postType,
        field1:             raw.field_1,
        field2:             raw.field_2,
        field3:             raw.field_3,
        createdAt:          raw.created_at,
        expiresAt:          raw.expires_at ?? new Date(Date.now() + expiryDays * 86_400_000).toISOString(),
        isOwnPost:          true,
        forwardedBy:        null,
        isForwardable:      false,
        myReactions:        [],
        reactions:          { can_help: [], know_someone: [], forward_count: 0 },
      }
      onCreated(post)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const COPY = {
    ask: {
      title:    'Ask',
      f1Label:  'What are you looking for?',
      f1Ph:     'e.g. A CTO for a fintech MVP',
      f2Label:  'Context',
      f2Ph:     'The situation, why now, what you\'ve already tried…',
      f3Label:  'Best fit',
      f3Ph:     'The kind of person, skill, or connection that would be ideal',
    },
    offer: {
      title:    'Offer',
      f1Label:  'What can you help with?',
      f1Ph:     'e.g. Reviewing pitch decks for pre-seed founders',
      f2Label:  'Context',
      f2Ph:     'How, what specifically, any caveats…',
      f3Label:  'Capacity',
      f3Ph:     'e.g. 1 hour this week · 3 founders this month',
    },
  }

  const copy = COPY[postType]

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 whitespace-normal"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-warm-white rounded-2xl shadow-xl w-full max-w-[520px] overflow-hidden">
        {step === 'pick' ? (
          <div className="p-6">
            <h2 className="font-display text-2xl font-bold text-navy mb-1">New post</h2>
            <p className="text-sm text-body-grey mb-6">What kind of post?</p>
            <div className="grid grid-cols-2 gap-3">
              {(['ask', 'offer'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => pick(type)}
                  className="group border border-border rounded-xl p-5 text-left hover:border-navy hover:bg-white transition-colors"
                >
                  <p className="font-semibold text-navy text-base mb-1 capitalize">{type}</p>
                  <p className="text-xs text-body-grey leading-relaxed">
                    {type === 'ask'
                      ? 'Something you\'re looking for — help, a connection, a resource.'
                      : 'Something you can give — expertise, time, an introduction.'}
                  </p>
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="mt-5 text-sm text-body-grey hover:text-navy transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={() => setStep('pick')}
                className="text-body-grey hover:text-navy transition-colors"
                aria-label="Back"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="font-display text-2xl font-bold text-navy">{copy.title}</h2>
            </div>

            {/* Field 1 */}
            <div>
              <label className="block text-sm font-medium text-navy mb-1">{copy.f1Label}</label>
              <input
                type="text"
                value={f1}
                maxLength={80}
                onChange={e => setF1(e.target.value)}
                placeholder={copy.f1Ph}
                className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
              />
              <p className="text-right text-[11px] text-body-grey mt-0.5">{f1.length}/80</p>
            </div>

            {/* Field 2 */}
            <div>
              <label className="block text-sm font-medium text-navy mb-1">{copy.f2Label}</label>
              <textarea
                value={f2}
                maxLength={240}
                onChange={e => setF2(e.target.value)}
                placeholder={copy.f2Ph}
                rows={3}
                className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy resize-none"
              />
              <p className="text-right text-[11px] text-body-grey -mt-0.5">{f2.length}/240</p>
            </div>

            {/* Field 3 */}
            <div>
              <label className="block text-sm font-medium text-navy mb-1">{copy.f3Label}</label>
              <input
                type="text"
                value={f3}
                maxLength={F3_MAX}
                onChange={e => setF3(e.target.value)}
                placeholder={copy.f3Ph}
                className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
              />
              <p className="text-right text-[11px] text-body-grey mt-0.5">{f3.length}/{F3_MAX}</p>
            </div>

            {error && (
              <p className="text-sm text-navy/70 bg-navy/5 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex flex-col gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting || !f1.trim() || !f2.trim() || !f3.trim()}
                className="w-full py-2.5 bg-lime text-navy text-sm font-semibold rounded-full hover:bg-lime/90 transition-colors disabled:opacity-40"
              >
                {submitting ? 'Sharing…' : 'Share with my network'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-body-grey hover:text-navy transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
