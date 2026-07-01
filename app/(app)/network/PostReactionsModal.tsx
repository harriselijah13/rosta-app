'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { FeedPost, Reactor } from './feedUtils'

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 2)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
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

function ReactorRow({ reactor }: { reactor: Reactor }) {
  const profileHref = reactor.username ? `/profile/${reactor.username}` : `/profile/${reactor.id}`
  const convHref = `/api/conversations/with/${reactor.id}`
  const firstName = reactor.name.split(' ')[0]

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <Link href={profileHref} className="shrink-0">
        <Avatar name={reactor.name} avatarUrl={reactor.avatar_url} />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={profileHref} className="text-sm font-semibold text-navy hover:underline block truncate">
          {reactor.name}
        </Link>
        <p className="text-xs text-body-grey">{relativeTime(reactor.reacted_at)}</p>
        {reactor.note && (
          <p className="font-display italic text-[13px] text-navy/70 mt-1 leading-snug">
            &ldquo;{reactor.note}&rdquo;
          </p>
        )}
      </div>
      <Link
        href={convHref}
        className="shrink-0 px-3 py-1.5 bg-navy text-warm-white text-xs font-medium rounded-full hover:opacity-80 transition-opacity whitespace-nowrap"
      >
        Message {firstName}
      </Link>
    </div>
  )
}

type Tab = 'can_help' | 'know_someone' | 'forwards'

type Props = {
  post: FeedPost
  onClose: () => void
  defaultTab?: 'can_help' | 'know_someone'
}

export default function PostReactionsModal({ post, onClose, defaultTab }: Props) {
  const { reactions } = post
  const tabs: Tab[] = []
  if (reactions.can_help.length > 0)    tabs.push('can_help')
  if (reactions.know_someone.length > 0) tabs.push('know_someone')
  if (reactions.forward_count > 0)       tabs.push('forwards')

  const [activeTab, setActiveTab] = useState<Tab>(defaultTab ?? tabs[0] ?? 'can_help')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const tabLabel: Record<Tab, string> = {
    can_help:     `I can help (${reactions.can_help.length})`,
    know_someone: `I know someone (${reactions.know_someone.length})`,
    forwards:     `Forwards (${reactions.forward_count})`,
  }

  const postKind = post.postType === 'ask' ? 'Ask' : 'Offer'
  const preview = post.field1.length > 80 ? post.field1.slice(0, 80) + '…' : post.field1

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-warm-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden"
           style={{ maxHeight: 'min(85vh, 640px)' }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-[22px] font-bold text-navy leading-tight">
                Reactions to your {postKind}
              </h2>
              <p className="text-sm text-navy/60 mt-1">{preview}</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-body-grey hover:bg-surface hover:text-navy transition-colors"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab pills */}
          {tabs.length > 1 && (
            <div className="flex gap-1.5 mt-4 flex-wrap">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activeTab === tab
                      ? 'bg-navy text-warm-white border-navy'
                      : 'bg-white text-navy border-border hover:border-navy'
                  }`}
                >
                  {tabLabel[tab]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6">
          {tabs.length === 0 && (
            <p className="text-sm text-navy/60 text-center py-10">No reactions yet.</p>
          )}

          {activeTab === 'can_help' && reactions.can_help.map(r => (
            <ReactorRow key={r.id} reactor={r} />
          ))}

          {activeTab === 'know_someone' && reactions.know_someone.map(r => (
            <ReactorRow key={r.id} reactor={r} />
          ))}

          {activeTab === 'forwards' && (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-navy mb-3">
                {reactions.forward_count} {reactions.forward_count === 1 ? 'person' : 'people'} forwarded this to someone in their network.
              </p>
              <p className="text-sm text-navy/60">
                Forwarders stay anonymous to keep forwarding feel natural.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
