'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PostCard from './PostCard'
import SignalUpdateCard from './SignalUpdateCard'
import ComposeModal from './ComposeModal'
import ForwardModal from './ForwardModal'
import type { FeedItem, FeedPost } from './feedUtils'

type Connection = { id: string; name: string; avatarUrl: string | null }

type Props = {
  initialItems: FeedItem[]
  initialHasMore: boolean
  currentUserId: string
  currentUserName: string
  currentUserAvatarUrl: string | null
  currentUserIsVerified: boolean
  currentUserUsername: string | null
  connections: Connection[]
}

export default function NetworkClient({
  initialItems, initialHasMore,
  currentUserId, currentUserName, currentUserAvatarUrl, currentUserIsVerified, currentUserUsername,
  connections,
}: Props) {
  const router = useRouter()
  const [items,    setItems]    = useState<FeedItem[]>(initialItems)
  const [hasMore,  setHasMore]  = useState(initialHasMore)
  const [loading,  setLoading]  = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [forwardTarget, setForwardTarget] = useState<string | null>(null)  // postId
  const [reactingIds,   setReactingIds]   = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load more ──────────────────────────────────────────────────────────────
  async function loadMore() {
    if (loading || !hasMore) return
    setLoading(true)
    const oldest = items[items.length - 1]?.createdAt ?? new Date().toISOString()
    try {
      const res = await fetch(`/api/network/feed?cursor=${encodeURIComponent(oldest)}`)
      if (!res.ok) throw new Error('Failed to load')
      const { items: next, hasMore: more } = await res.json()
      setItems(prev => [...prev, ...next])
      setHasMore(more)
    } catch {
      showToast('Could not load more. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Compose ────────────────────────────────────────────────────────────────
  function handleCreated(post: FeedPost) {
    setItems(prev => [post, ...prev])
    setShowCompose(false)
    showToast('Post shared with your network.')
  }

  // ── React ──────────────────────────────────────────────────────────────────
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

      // "I can help" — navigate to conversation with author after reacting
      if (action === 'add' && reactionType === 'can_help' && authorId) {
        router.push(`/api/conversations/with/${authorId}`)
      }
      // "I know someone" — navigate to suggest intro with author prefilled
      if (action === 'add' && reactionType === 'know_someone' && authorId) {
        router.push(`/intro/suggest?memberA=${authorId}`)
      }
    } catch {
      // Revert optimistic update on failure
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

  // ── Delete ─────────────────────────────────────────────────────────────────
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

  // ── Forward ────────────────────────────────────────────────────────────────
  function handleForwarded() {
    setForwardTarget(null)
    showToast('Post forwarded.')
  }

  const isEmpty = items.length === 0

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-navy text-warm-white text-sm font-medium px-5 py-3 rounded-full shadow-lg whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy mb-1">Network</h1>
          <p className="text-sm text-body-grey">What&apos;s happening in your network.</p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="shrink-0 flex items-center gap-1.5 bg-lime text-navy text-sm font-semibold px-4 py-2 rounded-full hover:bg-lime/90 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          New post
        </button>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="bg-white border border-border rounded-2xl p-10 text-center">
          <p className="font-display text-xl font-bold text-navy mb-2">Nothing in your network yet.</p>
          <p className="text-sm text-body-grey mb-6 max-w-xs mx-auto">
            When your connections post asks or offers, they&apos;ll show up here. You can start by sharing your own.
          </p>
          <button
            onClick={() => setShowCompose(true)}
            className="inline-flex items-center gap-1.5 bg-lime text-navy text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-lime/90 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            New post
          </button>
        </div>
      )}

      {/* Feed */}
      {!isEmpty && (
        <div className="flex flex-col gap-3">
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

          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={loadMore}
                disabled={loading}
                className="border border-navy text-navy text-sm font-medium px-6 py-2.5 rounded-full hover:bg-navy hover:text-warm-white transition-colors disabled:opacity-40"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Compose modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onCreated={handleCreated}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatarUrl={currentUserAvatarUrl}
          currentUserIsVerified={currentUserIsVerified}
          currentUserUsername={currentUserUsername}
        />
      )}

      {/* Forward modal */}
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
