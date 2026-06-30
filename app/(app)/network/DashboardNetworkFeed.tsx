'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PostCard from './PostCard'
import SignalUpdateCard from './SignalUpdateCard'
import ComposeModal from './ComposeModal'
import ForwardModal from './ForwardModal'
import type { FeedItem, FeedPost } from './feedUtils'
import type { PlatformActivityItem } from './platformActivity'

type Connection = { id: string; name: string; avatarUrl: string | null }

type Props = {
  feedItems: FeedItem[]
  platformActivity: PlatformActivityItem[]
  currentUserId: string
  currentUserName: string
  currentUserAvatarUrl: string | null
  currentUserIsVerified: boolean
  currentUserUsername: string | null
  connections: Connection[]
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 2)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function DashboardNetworkFeed({
  feedItems: initialFeedItems,
  platformActivity,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  currentUserIsVerified,
  currentUserUsername,
  connections,
}: Props) {
  const router = useRouter()
  const [items,         setItems]         = useState<FeedItem[]>(initialFeedItems)
  const [showCompose,   setShowCompose]   = useState(false)
  const [composeType,   setComposeType]   = useState<'ask' | 'offer' | undefined>(undefined)
  const [forwardTarget, setForwardTarget] = useState<string | null>(null)
  const [reactingIds,   setReactingIds]   = useState<Set<string>>(new Set())
  const [toast,         setToast]         = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function openCompose(type?: 'ask' | 'offer') {
    setComposeType(type)
    setShowCompose(true)
  }

  function handleCreated(post: FeedPost) {
    setItems(prev => [post, ...prev])
    setShowCompose(false)
    showToast('Post shared with your network.')
  }

  async function handleReact(
    itemId: string,
    reactionType: 'can_help' | 'know_someone' | 'noted',
    action: 'add' | 'remove',
    authorId?: string,
  ) {
    if (reactingIds.has(itemId)) return
    setReactingIds(prev => new Set(prev).add(itemId))

    // Optimistic update
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const reactions = item.myReactions
      const updated = action === 'add'
        ? Array.from(new Set([...reactions, reactionType]))
        : reactions.filter(r => r !== reactionType)
      return { ...item, myReactions: updated } as FeedItem
    }))

    try {
      await fetch(`/api/network/posts/${itemId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction_type: reactionType, action }),
      })
      if (action === 'add' && reactionType === 'can_help' && authorId) {
        router.push(`/api/conversations/with/${authorId}`)
      }
      if (action === 'add' && reactionType === 'know_someone' && authorId) {
        router.push(`/intro/suggest?memberA=${authorId}`)
      }
    } catch {
      // Revert optimistic update
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item
        const reactions = item.myReactions
        const reverted = action === 'add'
          ? reactions.filter(r => r !== reactionType)
          : Array.from(new Set([...reactions, reactionType]))
        return { ...item, myReactions: reverted } as FeedItem
      }))
    } finally {
      setReactingIds(prev => { const next = new Set(prev); next.delete(itemId); return next })
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm('Delete this post? It cannot be restored.')) return
    try {
      await fetch(`/api/network/posts/${postId}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i.id !== postId))
      showToast('Post deleted.')
    } catch {
      showToast('Could not delete post. Try again.')
    }
  }

  function handleForwarded() {
    setForwardTarget(null)
    showToast('Post forwarded.')
  }

  const initials = currentUserName.trim().split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <div className="mb-10">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-navy text-warm-white text-sm font-medium px-5 py-3 rounded-full shadow-lg whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}

      {/* Section heading row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-navy">Your network</h2>
          <p className="text-sm text-body-grey mt-0.5">What&apos;s happening with the people you know.</p>
        </div>
        <button
          onClick={() => openCompose()}
          className="shrink-0 flex items-center gap-1.5 bg-lime text-navy text-sm font-semibold px-4 py-2 rounded-full hover:bg-lime/90 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          New post
        </button>
      </div>

      {/* Inline compose prompt — always shown */}
      <div className="bg-white border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          {currentUserAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUserAvatarUrl} alt={currentUserName} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <span className="w-8 h-8 rounded-full bg-navy/10 text-navy text-xs font-semibold flex items-center justify-center shrink-0">
              {initials}
            </span>
          )}
          <p className="text-sm font-medium text-navy/70">What are you working on, or what do you need?</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => openCompose('ask')}
            className="px-4 py-1.5 rounded-full border border-navy text-navy text-sm font-medium hover:bg-navy hover:text-warm-white transition-colors"
          >
            Share an Ask
          </button>
          <button
            onClick={() => openCompose('offer')}
            className="px-4 py-1.5 rounded-full border border-navy text-navy text-sm font-medium hover:bg-navy hover:text-warm-white transition-colors"
          >
            Share an Offer
          </button>
        </div>
      </div>

      {/* Personal feed items */}
      {items.length > 0 && (
        <div className="flex flex-col gap-3 mb-6">
          {items.map(item => {
            if (item.kind === 'post') {
              return (
                <PostCard
                  key={item.id}
                  post={item}
                  onReact={(type, action) => handleReact(item.id, type, action, item.authorId)}
                  onForward={() => setForwardTarget(item.id)}
                  onDelete={() => handleDelete(item.id)}
                  reacting={reactingIds.has(item.id)}
                />
              )
            }
            return (
              <SignalUpdateCard
                key={item.id}
                update={item}
                onReact={(type, action) => handleReact(item.id, type, action)}
                reacting={reactingIds.has(item.id)}
              />
            )
          })}
        </div>
      )}

      {/* Around ROSTA — always shown if there's data */}
      {platformActivity.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-navy/70 uppercase tracking-widest mb-2">Around ROSTA</p>
          <div className="flex flex-col gap-1.5">
            {platformActivity.map(item => (
              <div
                key={item.id}
                className="bg-surface border border-border/50 rounded-lg px-3 py-3 flex items-center justify-between gap-3"
              >
                <p className="text-sm text-navy/70">{item.text}</p>
                <span className="text-[11px] text-body-grey shrink-0 whitespace-nowrap">{relativeTime(item.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View all activity link */}
      <div className="mt-3">
        <Link href="/network" className="text-sm font-medium text-navy underline underline-offset-2 hover:text-navy/70 transition-colors">
          View all activity →
        </Link>
      </div>

      {/* Modals */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onCreated={handleCreated}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatarUrl={currentUserAvatarUrl}
          currentUserIsVerified={currentUserIsVerified}
          currentUserUsername={currentUserUsername}
          initialType={composeType}
        />
      )}
      {forwardTarget && (
        <ForwardModal
          postId={forwardTarget}
          connections={connections}
          onClose={() => setForwardTarget(null)}
          onForwarded={handleForwarded}
        />
      )}
    </div>
  )
}
