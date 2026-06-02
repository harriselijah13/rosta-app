'use client'

import { useState } from 'react'
import Link from 'next/link'

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
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? rows.filter(r => {
        const n = [r.otherUser.first_name, r.otherUser.last_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return n.includes(query.toLowerCase())
      })
    : rows

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
            [row.otherUser.first_name, row.otherUser.last_name].filter(Boolean).join(' ') ||
            'Member'
          const hasUnread = row.unreadCount > 0
          const preview = row.lastMessage
            ? (row.lastMessage.sender_id === currentUserId ? 'You: ' : '') +
              (row.lastMessage.body.length > 60
                ? row.lastMessage.body.slice(0, 60) + '…'
                : row.lastMessage.body)
            : 'No messages yet — say hello'

          return (
            <Link
              key={row.id}
              href={`/messages/${row.id}`}
              className="flex items-center gap-4 px-4 py-4 hover:bg-surface transition-colors"
            >
              {row.otherUser.avatar_url ? (
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
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-sm truncate ${
                      hasUnread ? 'font-semibold text-navy' : 'font-medium text-navy'
                    }`}
                  >
                    {displayName}
                  </p>
                  {row.lastMessage && (
                    <p className="text-xs text-body-grey shrink-0">
                      {formatInboxTime(row.lastMessage.created_at)}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-sm truncate mt-0.5 ${
                      hasUnread ? 'text-navy' : 'text-body-grey'
                    }`}
                  >
                    {preview}
                  </p>
                  {hasUnread && (
                    <span className="shrink-0 w-5 h-5 rounded-full bg-lime text-navy text-[10px] font-bold flex items-center justify-center">
                      {row.unreadCount > 9 ? '9+' : row.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
