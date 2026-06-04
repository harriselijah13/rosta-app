'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Message = {
  id: string
  room_id: string
  sender_id: string
  content: string
  created_at: string
}

type Member = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  username: string | null
}

type Props = {
  roomId: string
  prompt: string
  daysLeft: number
  currentUserId: string
  members: Member[]
  initialMessages: Message[]
}

function memberName(m: Member | undefined): string {
  if (!m) return 'A member'
  return [m.first_name, m.last_name].filter(Boolean).join(' ') || 'A member'
}

function memberInitials(m: Member | undefined): string {
  if (!m) return '?'
  return [m.first_name?.[0], m.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (diffDays < 7)
    return (
      d.toLocaleDateString('en-GB', { weekday: 'short' }) +
      ' ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    )
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function OpenTableThread({
  roomId,
  prompt,
  daysLeft,
  currentUserId,
  members,
  initialMessages,
}: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const byId = Object.fromEntries(members.map(m => [m.id, m]))

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`open-table-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'open_table_messages',
          filter: `room_id=eq.${roomId}`,
        },
        payload => {
          const msg = payload.new as Message
          setMessages(prev =>
            prev.some(m => m.id === msg.id) ? prev : [...prev, msg]
          )
          // Update last_read_at silently
          supabase
            .from('open_table_members')
            .update({ last_read_at: new Date().toISOString() })
            .eq('room_id', roomId)
            .eq('user_id', currentUserId)
            .then(() => {})
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId, currentUserId, supabase])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setDraft('')
    const { data, error } = await supabase
      .from('open_table_messages')
      .insert({ room_id: roomId, sender_id: currentUserId, content })
      .select('id, room_id, sender_id, content, created_at')
      .single()
    if (!error && data) {
      setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data])
    }
    setSending(false)
  }

  return (
    <div className="flex flex-col h-svh bg-warm-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-border px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-start gap-4">
          <Link
            href="/dashboard"
            className="shrink-0 mt-0.5 text-body-grey hover:text-navy transition-colors"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-lg font-bold text-navy">Open Table</h1>
              <span className="text-xs text-body-grey border border-border rounded-full px-2 py-0.5">
                {daysLeft}d left
              </span>
            </div>
            {/* Member avatars */}
            <div className="flex items-center gap-1 mt-1">
              {members.map(m => (
                m.avatar_url ? (
                  <img
                    key={m.id}
                    src={m.avatar_url}
                    alt={memberName(m)}
                    title={memberName(m)}
                    className="w-5 h-5 rounded-full object-cover border border-white"
                  />
                ) : (
                  <div
                    key={m.id}
                    title={memberName(m)}
                    className="w-5 h-5 rounded-full bg-navy/10 text-navy text-[9px] font-bold flex items-center justify-center border border-white"
                  >
                    {memberInitials(m)}
                  </div>
                )
              ))}
              <span className="text-xs text-body-grey ml-1">{members.length} people</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prompt pin */}
      <div className="bg-surface border-b border-border px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-medium text-body-grey uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
            Opening prompt
          </p>
          <p className="text-sm text-navy font-medium leading-snug">{prompt}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-body-grey py-10">
              No messages yet — be the first to respond to the prompt above.
            </p>
          )}
          {messages.map(msg => {
            const isMe = msg.sender_id === currentUserId
            const sender = byId[msg.sender_id]
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                {!isMe && (
                  sender?.avatar_url ? (
                    <img
                      src={sender.avatar_url}
                      alt={memberName(sender)}
                      className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-navy/10 text-navy text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      {memberInitials(sender)}
                    </div>
                  )
                )}
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {!isMe && (
                    <p className="text-xs text-body-grey font-medium">{memberName(sender)}</p>
                  )}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? 'bg-navy text-warm-white rounded-tr-sm'
                        : 'bg-white border border-border text-navy rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <p className="text-[11px] text-body-grey">{formatTime(msg.created_at)}</p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Compose */}
      <div className="border-t border-border bg-white px-4 sm:px-6 py-4">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) }
            }}
            placeholder="Reply to the group…"
            rows={1}
            className="flex-1 resize-none px-4 py-3 bg-surface border border-border rounded-2xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors text-sm leading-relaxed"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="shrink-0 w-10 h-10 rounded-full bg-navy text-warm-white flex items-center justify-center hover:bg-navy/90 transition-colors disabled:opacity-40"
            aria-label="Send"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
