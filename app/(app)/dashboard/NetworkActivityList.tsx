'use client'

import { useState } from 'react'
import Link from 'next/link'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import { OPEN_TO_OPTIONS } from '@/lib/constants'

const OPEN_TO_MAP = Object.fromEntries(OPEN_TO_OPTIONS.map(o => [o.value, o.label]))

export type ActivityItem = {
  userId: string
  name: string
  avatarUrl: string | null
  isVerified: boolean
  profileSlug: string
  initials: string
  workingOn: string | null
  needRightNow: string | null
  openTo: string[]
  updatedAt: string
  conversationId: string | null
}

type SignalType = 'need' | 'working' | 'signals'

interface Resolved {
  type: SignalType
  eyebrow: string
  content: string
}

function resolveSignal(item: ActivityItem): Resolved {
  if (item.needRightNow) {
    return { type: 'need', eyebrow: 'Need right now', content: item.needRightNow }
  }
  if (item.workingOn) {
    return { type: 'working', eyebrow: 'Working on', content: item.workingOn }
  }
  const labels = item.openTo.filter(v => v !== 'open_door').map(v => OPEN_TO_MAP[v] ?? v)
  if (labels.length > 0) {
    return { type: 'signals', eyebrow: 'Open to', content: labels.join(', ') }
  }
  return { type: 'signals', eyebrow: 'Signals', content: 'Updated their signals.' }
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 2)   return 'Just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function HelpDropdown({ item, messageHref }: { item: ActivityItem; messageHref: string }) {
  const [open, setOpen] = useState(false)
  const firstName = item.name.split(' ')[0]

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-navy text-white text-[13px] font-medium hover:bg-navy/90 transition-colors"
      >
        Help
        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* Click-outside dismiss */}
          <button
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            tabIndex={-1}
            aria-hidden
          />
          <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[168px]">
            <Link
              href={`/intro/suggest?memberA=${item.userId}`}
              className="block px-4 py-2.5 text-sm text-navy hover:bg-surface transition-colors"
              onClick={() => setOpen(false)}
            >
              Suggest an intro
            </Link>
            <Link
              href={messageHref}
              className="block px-4 py-2.5 text-sm text-navy hover:bg-surface transition-colors"
              onClick={() => setOpen(false)}
            >
              Message {firstName}
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const signal = resolveSignal(item)
  const messageHref = item.conversationId
    ? `/messages/${item.conversationId}`
    : `/api/conversations/with/${item.userId}`

  return (
    <div className="flex items-start gap-4 px-5 py-4 border-b border-border last:border-b-0">
      {/* Avatar */}
      <Link href={`/profile/${item.profileSlug}`} className="shrink-0 mt-0.5">
        {item.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.avatarUrl} alt={item.name} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-navy/10 text-navy font-semibold flex items-center justify-center text-sm">
            {item.initials || '?'}
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: name + contextual action */}
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/profile/${item.profileSlug}`}
            className="text-sm font-semibold text-navy hover:underline inline-flex items-center gap-1 min-w-0"
          >
            {item.name}
            {item.isVerified && <VerifiedBadge />}
          </Link>

          {signal.type === 'need' ? (
            <HelpDropdown item={item} messageHref={messageHref} />
          ) : signal.type === 'working' ? (
            <Link
              href={messageHref}
              className="shrink-0 px-3 py-1.5 rounded-full border border-border text-navy text-[13px] font-medium
                hover:border-navy hover:bg-surface/60 transition-colors whitespace-nowrap"
            >
              Reply
            </Link>
          ) : (
            <Link
              href={`/profile/${item.profileSlug}`}
              className="shrink-0 px-3 py-1.5 rounded-full border border-border text-navy text-[13px] font-medium
                hover:border-navy hover:bg-surface/60 transition-colors whitespace-nowrap"
            >
              View profile
            </Link>
          )}
        </div>

        {/* Line 2: signal-type eyebrow */}
        <p
          className="text-[10px] font-medium uppercase tracking-wider mt-1.5"
          style={{ color: 'rgba(15,27,60,0.45)' }}
        >
          {signal.eyebrow}
        </p>

        {/* Line 3: signal content */}
        <p className="text-[15px] text-navy mt-0.5 leading-snug">{signal.content}</p>

        {/* Line 4: relative timestamp */}
        <p className="text-xs mt-1.5" style={{ color: 'rgba(15,27,60,0.40)' }}>
          {relativeTime(item.updatedAt)}
        </p>
      </div>
    </div>
  )
}

export default function NetworkActivityList({
  items,
  hasMore,
}: {
  items: ActivityItem[]
  hasMore: boolean
}) {
  if (items.length === 0) {
    return (
      <div
        className="bg-white border border-border rounded-2xl px-6 py-8 text-center
          shadow-[0_4px_16px_rgba(15,27,60,0.08)]"
      >
        <p
          className="text-[10px] font-medium uppercase tracking-wider mb-1.5"
          style={{ color: 'rgba(15,27,60,0.45)' }}
        >
          Quiet week
        </p>
        <p className="text-sm text-body-grey">
          When your connections update their signals, you&apos;ll see it here.
        </p>
      </div>
    )
  }

  return (
    <div
      className="bg-white border border-border rounded-2xl overflow-hidden
        shadow-[0_4px_16px_rgba(15,27,60,0.08)]"
    >
      {items.map(item => (
        <ActivityRow key={item.userId} item={item} />
      ))}
      {hasMore && (
        <div className="px-5 py-3 border-t border-border">
          <Link
            href="/activity"
            className="text-xs font-medium text-body-grey hover:text-navy transition-colors"
          >
            View all activity →
          </Link>
        </div>
      )}
    </div>
  )
}
