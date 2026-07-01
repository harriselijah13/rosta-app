/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AppNotification, ReactionCanHelpPayload, ReactionKnowSomeonePayload, PostForwardedPayload } from '@/lib/notifications'
import { loadMoreNotificationsAction } from './actions'

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

// ── Icons ──────────────────────────────────────────────────────────────────────
const HandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8l3 3h8" />
  </svg>
)
const PersonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)

function NotifIcon({ type }: { type: AppNotification['type'] }) {
  const cls = 'w-8 h-8 rounded-full flex items-center justify-center shrink-0'
  if (type === 'reaction_can_help')    return <div className={`${cls} bg-navy/8 text-navy`}><HandIcon /></div>
  if (type === 'reaction_know_someone') return <div className={`${cls} bg-navy/8 text-navy`}><PersonIcon /></div>
  return <div className={`${cls} bg-navy/8 text-navy`}><ArrowIcon /></div>
}

function NotifRow({ notif }: { notif: AppNotification }) {
  const p = notif.payload as any
  let text = ''
  let previewText = ''
  let actionNode: React.ReactNode = null

  if (notif.type === 'reaction_can_help') {
    const payload = p as ReactionCanHelpPayload
    const firstName = payload.reactor_name.split(' ')[0]
    const kind = payload.post_type === 'ask' ? 'Ask' : 'Offer'
    text = `${firstName} can help with your ${kind}.`
    previewText = payload.post_field_1.length > 60
      ? payload.post_field_1.slice(0, 60) + '…'
      : payload.post_field_1
    actionNode = (
      <Link
        href={`/api/conversations/with/${payload.reactor_id}`}
        className="shrink-0 text-xs text-navy/60 hover:text-navy transition-colors whitespace-nowrap"
      >
        Message {firstName}
      </Link>
    )
  } else if (notif.type === 'reaction_know_someone') {
    const payload = p as ReactionKnowSomeonePayload
    const firstName = payload.reactor_name.split(' ')[0]
    const kind = payload.post_type === 'ask' ? 'Ask' : 'Offer'
    text = `${firstName} knows someone for your ${kind}.`
    previewText = payload.post_field_1.length > 60
      ? payload.post_field_1.slice(0, 60) + '…'
      : payload.post_field_1
    actionNode = (
      <Link
        href={`/api/conversations/with/${payload.reactor_id}`}
        className="shrink-0 text-xs text-navy/60 hover:text-navy transition-colors whitespace-nowrap"
      >
        Message {firstName}
      </Link>
    )
  } else {
    const payload = p as PostForwardedPayload
    const kind = payload.post_type === 'ask' ? 'Ask' : 'Offer'
    text = `Your ${kind} was forwarded.`
    previewText = payload.post_field_1.length > 60
      ? payload.post_field_1.slice(0, 60) + '…'
      : payload.post_field_1
    actionNode = (
      <Link
        href="/network"
        className="shrink-0 text-xs text-navy/60 hover:text-navy transition-colors whitespace-nowrap"
      >
        View post →
      </Link>
    )
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-white border border-border rounded-xl">
      <NotifIcon type={notif.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy leading-snug">{text}</p>
        {previewText && (
          <p className="font-display italic text-[13px] text-navy/60 mt-0.5 leading-snug">
            &ldquo;{previewText}&rdquo;
          </p>
        )}
        <p className="text-xs text-body-grey mt-1">{relativeTime(notif.created_at)}</p>
      </div>
      {actionNode && <div className="pt-0.5">{actionNode}</div>}
    </div>
  )
}

type Props = {
  initialNotifications: AppNotification[]
  initialHasMore: boolean
  initialNextCursor: string | undefined
}

export default function NotificationsClient({
  initialNotifications,
  initialHasMore,
  initialNextCursor,
}: Props) {
  const [items, setItems]         = useState(initialNotifications)
  const [hasMore, setHasMore]     = useState(initialHasMore)
  const [cursor, setCursor]       = useState(initialNextCursor)
  const [loading, setLoading]     = useState(false)

  async function handleLoadMore() {
    if (!cursor || loading) return
    setLoading(true)
    const raw = await loadMoreNotificationsAction(cursor)
    const more = raw.length > 20 ? raw.slice(0, 20) : raw
    setItems(prev => [...prev, ...more])
    setHasMore(raw.length > 20)
    setCursor(raw.length > 20 ? more[more.length - 1].created_at : undefined)
    setLoading(false)
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl px-6 py-16 text-center">
        <p className="text-sm font-medium text-navy/60">You&rsquo;re all caught up.</p>
        <p className="text-xs text-navy/40 mt-2 max-w-xs mx-auto">
          When people react to your posts or forward them, you&rsquo;ll see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map(notif => (
        <NotifRow key={notif.id} notif={notif} />
      ))}

      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loading}
          className="mt-4 w-full py-3 border border-border rounded-xl text-sm font-medium text-navy hover:bg-surface transition-colors disabled:opacity-40"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
