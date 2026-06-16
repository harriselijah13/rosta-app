'use client'

import { useState } from 'react'
import Link from 'next/link'

function XIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export type ConversationRow = {
  id: string
  otherUser: {
    id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    username: string | null
  }
  lastMessage: { body: string; created_at: string; sender_id: string } | null
  unreadCount: number
}

function formatInboxTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (diffDays < 7)
    return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function initials(u: ConversationRow['otherUser']) {
  return [u.first_name?.[0], u.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
}

export default function InboxList({
  rows,
  currentUserId,
}: {
  rows: ConversationRow[]
  currentUserId: string
}) {
  const [query,        setQuery]        = useState('')
  const [localRows,    setLocalRows]    = useState(rows)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)

  const filtered = query.trim()
    ? localRows.filter(r => {
        const n = [r.otherUser.first_name, r.otherUser.last_name]
          .filter(Boolean).join(' ').toLowerCase()
        return n.includes(query.toLowerCase())
      })
    : localRows

  async function handleDelete(convId: string) {
    setConfirmingId(null)
    setDeletingId(convId)
    setLocalRows(prev => prev.filter(r => r.id !== convId))
    try {
      const res = await fetch(`/api/conversations/${convId}`, { method: 'DELETE' })
      if (!res.ok) setLocalRows(rows)
    } catch {
      setLocalRows(rows)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search conversations…"
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-navy placeholder:text-body-grey focus:outline-none focus:border-navy"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="divide-y divide-border rounded-xl border border-border bg-white overflow-hidden">
        {filtered.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-body-grey">
            {query ? 'No results.' : 'No conversations yet.'}
          </p>
        )}
        {filtered.map(row => {
          const displayName =
            [row.otherUser.first_name, row.otherUser.last_name].filter(Boolean).join(' ') || 'Member'
          const hasUnread    = row.unreadCount > 0
          const isConfirming = confirmingId === row.id
          const isDeleting   = deletingId === row.id
          const preview = row.lastMessage
            ? (row.lastMessage.sender_id === currentUserId ? 'You: ' : '') +
              (row.lastMessage.body.length > 60
                ? row.lastMessage.body.slice(0, 60) + '…'
                : row.lastMessage.body)
            : 'No messages yet — say hello'

          return (
            <div key={row.id} className="group flex items-stretch">

              {/* Main link area */}
              <Link
                href={`/messages/${row.id}`}
                className={`flex items-center gap-4 px-4 py-4 hover:bg-surface transition-colors flex-1 min-w-0 ${
                  isConfirming ? 'pointer-events-none' : ''
                }`}
                tabIndex={isConfirming ? -1 : undefined}
              >
                {row.otherUser.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.otherUser.avatar_url}
                    alt=""
                    className="w-11 h-11 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-navy text-warm-white text-sm font-bold flex items-center justify-center shrink-0">
                    {initials(row.otherUser)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${hasUnread ? 'font-semibold text-navy' : 'font-medium text-navy'}`}>
                    {displayName}
                  </p>
                  <p className={`text-sm truncate mt-0.5 ${hasUnread ? 'text-navy' : 'text-body-grey'}`}>
                    {preview}
                  </p>
                </div>
              </Link>

              {/* Right-side controls */}
              {isConfirming ? (
                <div className="flex items-center gap-2 px-4 shrink-0">
                  <span className="text-xs text-body-grey whitespace-nowrap">Delete this conversation?</span>
                  <button
                    onClick={() => handleDelete(row.id)}
                    className="text-xs font-semibold text-navy hover:underline whitespace-nowrap"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="text-xs text-body-grey hover:text-navy whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 shrink-0">
                  {row.lastMessage && !isDeleting && (
                    <p className="text-xs text-body-grey">
                      {formatInboxTime(row.lastMessage.created_at)}
                    </p>
                  )}
                  {hasUnread && !isDeleting && (
                    <span className="w-5 h-5 rounded-full bg-lime text-navy text-[10px] font-bold flex items-center justify-center">
                      {row.unreadCount > 9 ? '9+' : row.unreadCount}
                    </span>
                  )}
                  <button
                    onClick={() => setConfirmingId(row.id)}
                    disabled={isDeleting}
                    aria-label={`Delete conversation with ${displayName}`}
                    className="opacity-0 group-hover:opacity-100 p-1 text-body-grey hover:text-navy transition-opacity disabled:opacity-20"
                  >
                    <XIcon />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
