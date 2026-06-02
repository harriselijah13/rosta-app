'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import OutcomeActions from './OutcomeActions'

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  read_at: string | null
  created_at: string
}

type OtherProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  username: string | null
}

type Props = {
  conversationId: string
  currentUserId: string
  otherProfile: OtherProfile
  initialMessages: Message[]
  hasOutcome: boolean
  introRequestId: string | null
  facilitatorId: string | null
  thankYouSent: boolean
}

function initials(p: OtherProfile) {
  return [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
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

export default function MessageThread({
  conversationId,
  currentUserId,
  otherProfile,
  initialMessages,
  hasOutcome,
  introRequestId,
  facilitatorId,
  thankYouSent,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  const displayName =
    [otherProfile.first_name, otherProfile.last_name].filter(Boolean).join(' ') || 'Member'

  // Scroll to bottom on load and on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async payload => {
          const msg = payload.new as Message
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
          // Mark as read immediately if the other party sent it
          if (msg.sender_id !== currentUserId) {
            await supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', msg.id)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId, supabase])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, body: text }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        console.error('[send]', error)
        setInput(text)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100svh - 65px)' }}>
      {/* Header */}
      <div className="border-b border-border bg-white px-4 py-3 flex items-center gap-3 shrink-0">
        <Link
          href="/messages"
          className="text-body-grey hover:text-navy transition-colors mr-1 p-1 -ml-1"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        {otherProfile.avatar_url ? (
          <img
            src={otherProfile.avatar_url}
            alt=""
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-navy text-warm-white text-sm font-bold flex items-center justify-center shrink-0">
            {initials(otherProfile)}
          </div>
        )}
        <Link
          href={`/profile/${otherProfile.username ?? otherProfile.id}`}
          className="text-sm font-semibold text-navy hover:underline"
        >
          {displayName}
        </Link>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-warm-white">
        {messages.length === 0 && (
          <p className="text-center text-body-grey text-sm py-12">
            No messages yet — say hello!
          </p>
        )}
        {messages.map(msg => {
          const isMine = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMine
                    ? 'bg-navy text-warm-white rounded-br-sm'
                    : 'bg-white border border-border text-navy rounded-bl-sm'
                }`}
              >
                <p style={{ wordBreak: 'break-word' }}>{msg.body}</p>
                <p
                  className={`text-[11px] mt-1 ${
                    isMine ? 'text-warm-white/60' : 'text-body-grey'
                  }`}
                >
                  {formatTime(msg.created_at)}
                  {isMine && msg.read_at && <span className="ml-1.5">· Read</span>}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Outcome + thank-you actions */}
      <OutcomeActions
        conversationId={conversationId}
        hasOutcome={hasOutcome}
        introRequestId={introRequestId}
        facilitatorId={facilitatorId}
        currentUserId={currentUserId}
        thankYouSent={thankYouSent}
      />

      {/* Input */}
      <form
        onSubmit={send}
        className="shrink-0 border-t border-border bg-white px-4 py-3 flex gap-3 items-end"
      >
        <textarea
          ref={textareaRef}
          className="flex-1 resize-none rounded-xl border border-border px-4 py-2.5 text-sm text-navy placeholder:text-body-grey focus:outline-none focus:border-navy bg-surface"
          style={{ minHeight: '44px', maxHeight: '128px' }}
          placeholder="Send a message…"
          value={input}
          rows={1}
          onChange={e => {
            setInput(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(e as unknown as React.FormEvent)
            }
          }}
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="shrink-0 bg-lime text-navy font-semibold text-sm px-5 py-2.5 rounded-full disabled:opacity-40 hover:bg-lime/90 transition-colors"
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
