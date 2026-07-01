'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { FeedPost } from './feedUtils'
import PostReactionsModal from './PostReactionsModal'

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 2)   return 'Just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function expiryLabel(isoExpires: string): string {
  const msLeft = new Date(isoExpires).getTime() - Date.now()
  const days = Math.ceil(msLeft / 86_400_000)
  if (days <= 0)  return 'Expired'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} days`
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />
  }
  return (
    <span className="w-8 h-8 rounded-full bg-navy/10 text-navy text-xs font-semibold flex items-center justify-center shrink-0">
      {initials}
    </span>
  )
}

type ReactionType = 'can_help' | 'know_someone' | 'noted'

function ReactionButton({
  label, icon, active, disabled, onClick,
}: {
  label: string
  icon: React.ReactNode
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40
        ${active
          ? 'bg-navy text-warm-white'
          : 'text-body-grey hover:text-navy hover:bg-surface'
        }`}
    >
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      <span className="text-[11px] font-medium leading-none whitespace-nowrap">{label}</span>
    </button>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const HandIcon = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8l3 3h8" />
  </svg>
)
const PersonIcon = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
)

type Props = {
  post: FeedPost
  onReact: (type: ReactionType, action: 'add' | 'remove') => Promise<void>
  onForward: () => void
  onDelete: () => void
  reacting: boolean
}

export default function PostCard({ post, onReact, onForward, onDelete, reacting }: Props) {
  const [showReactions, setShowReactions] = useState(false)
  const [reactionsDefaultTab, setReactionsDefaultTab] = useState<'can_help' | 'know_someone' | null>(null)
  const authorHref = post.authorUsername ? `/profile/${post.authorUsername}` : `/profile/${post.authorId}`

  const FIELD_LABELS = {
    ask:   { f1: 'Looking for', f3Label: 'BEST FIT' },
    offer: { f1: 'Offering',    f3Label: 'CAPACITY' },
  }
  const labels = FIELD_LABELS[post.postType]

  function handleReact(type: ReactionType) {
    const alreadyReacted = post.myReactions.includes(type)
    onReact(type, alreadyReacted ? 'remove' : 'add')
  }

  return (
    <article className="bg-white border border-border rounded-xl p-4 sm:p-5 flex flex-col gap-3">
      {/* Forward attribution */}
      {post.forwardedBy && (
        <p className="text-[11px] text-body-grey -mb-1">
          Forwarded by {post.forwardedBy.name}
        </p>
      )}

      {/* Header row */}
      <div className="flex items-start gap-3">
        <Link href={authorHref} className="shrink-0">
          <Avatar name={post.authorName} avatarUrl={post.authorAvatarUrl} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={authorHref} className="text-sm font-medium text-navy hover:underline truncate">
              {post.authorName}
            </Link>
            {post.authorIsVerified && (
              <span className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full bg-lime shrink-0">
                <svg viewBox="0 0 20 20" fill="none" className="w-2.5 h-2.5">
                  <path d="M5 10.5l3 3 7-7" stroke="#0F1B3C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              post.postType === 'ask'
                ? 'bg-navy text-warm-white'
                : 'bg-navy/10 text-navy'
            }`}>
              {post.postType === 'ask' ? 'Ask' : 'Offer'}
            </span>
            <span className="text-xs text-body-grey ml-auto shrink-0">{relativeTime(post.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-body-grey">{labels.f1}</p>
        <p className="text-base font-semibold text-navy leading-snug">{post.field1}</p>
        <p className="text-sm text-navy/70 leading-relaxed">{post.field2}</p>

        {/* Field 3 block */}
        <div className="border border-border rounded-lg px-3 py-2 mt-1">
          <p className="text-[11px] font-semibold text-body-grey uppercase tracking-wide mb-0.5">
            {labels.f3Label}
          </p>
          <p className="text-sm font-medium text-navy">{post.field3}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border pt-3 -mb-1">
        <div className="flex items-center gap-1">
          {post.isOwnPost ? (
            <>
              <ReactionButton
                label={post.reaction_counts.can_help > 0 ? `I can help (${post.reaction_counts.can_help})` : 'I can help'}
                icon={<HandIcon filled={false} />}
                active={false}
                disabled={false}
                onClick={() => {
                  if (post.reaction_counts.can_help > 0) {
                    setReactionsDefaultTab('can_help')
                    setShowReactions(true)
                  }
                }}
              />
              <ReactionButton
                label={post.reaction_counts.know_someone > 0 ? `I know someone (${post.reaction_counts.know_someone})` : 'I know someone'}
                icon={<PersonIcon filled={false} />}
                active={false}
                disabled={false}
                onClick={() => {
                  if (post.reaction_counts.know_someone > 0) {
                    setReactionsDefaultTab('know_someone')
                    setShowReactions(true)
                  }
                }}
              />
              <span className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-body-grey cursor-default">
                <span className="w-5 h-5 flex items-center justify-center">
                  <BookmarkIcon filled={false} />
                </span>
                <span className="text-[11px] font-medium leading-none whitespace-nowrap">
                  {post.reaction_counts.noted > 0 ? `Noted (${post.reaction_counts.noted})` : 'Noted'}
                </span>
              </span>
            </>
          ) : (
            <>
              <ReactionButton
                label={post.reaction_counts.can_help > 0 ? `I can help (${post.reaction_counts.can_help})` : 'I can help'}
                icon={<HandIcon filled={post.myReactions.includes('can_help')} />}
                active={post.myReactions.includes('can_help')}
                disabled={reacting}
                onClick={() => handleReact('can_help')}
              />
              <ReactionButton
                label={post.reaction_counts.know_someone > 0 ? `I know someone (${post.reaction_counts.know_someone})` : 'I know someone'}
                icon={<PersonIcon filled={post.myReactions.includes('know_someone')} />}
                active={post.myReactions.includes('know_someone')}
                disabled={reacting}
                onClick={() => handleReact('know_someone')}
              />
              <ReactionButton
                label={post.reaction_counts.noted > 0 ? `Noted (${post.reaction_counts.noted})` : 'Noted'}
                icon={<BookmarkIcon filled={post.myReactions.includes('noted')} />}
                active={post.myReactions.includes('noted')}
                disabled={reacting}
                onClick={() => handleReact('noted')}
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {post.isOwnPost ? (
            <>
              <button
                onClick={onDelete}
                className="text-xs text-body-grey hover:text-navy transition-colors"
              >
                Delete post
              </button>
              {post.reactions.forward_count > 0 && (
                <p className="text-[11px] text-body-grey">
                  → {post.reactions.forward_count} {post.reactions.forward_count === 1 ? 'forward' : 'forwards'}
                </p>
              )}
            </>
          ) : (
            post.isForwardable && (
              <button
                onClick={onForward}
                className="text-xs text-body-grey hover:text-navy transition-colors"
              >
                Forward
              </button>
            )
          )}
          <p className="text-[11px] text-body-grey">{expiryLabel(post.expiresAt)}</p>
        </div>
      </div>

      {showReactions && (
        <PostReactionsModal
          post={post}
          defaultTab={reactionsDefaultTab ?? undefined}
          onClose={() => { setShowReactions(false); setReactionsDefaultTab(null) }}
        />
      )}
    </article>
  )
}
