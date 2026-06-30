'use client'

import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'

type Connection = { id: string; name: string; avatarUrl: string | null }

type Props = {
  postId: string
  connections: Connection[]
  onClose: () => void
  onForwarded: () => void
}

export default function ForwardModal({ postId, connections, onClose, onForwarded }: Props) {
  const [selected, setSelected]     = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = connections.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleForward() {
    if (!selected || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/network/posts/${postId}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: selected }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Failed to forward.')
      }
      onForwarded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 whitespace-normal"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-warm-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-6 flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-navy mb-1">Forward to a connection</h2>
            <p className="text-sm text-body-grey">Pick one person. They&apos;ll see the post in their Network view.</p>
          </div>

          {connections.length > 5 && (
            <input
              type="text"
              placeholder="Search connections…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
          )}

          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto -mx-1 px-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-body-grey text-center py-4">No connections found.</p>
            ) : filtered.map(conn => (
              <button
                key={conn.id}
                onClick={() => setSelected(conn.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selected === conn.id
                    ? 'bg-navy text-warm-white'
                    : 'hover:bg-white text-navy'
                }`}
              >
                {conn.avatarUrl ? (
                  <img src={conn.avatarUrl} alt={conn.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    selected === conn.id ? 'bg-white/20 text-warm-white' : 'bg-navy/10 text-navy'
                  }`}>
                    {conn.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                )}
                <span className="text-sm font-medium">{conn.name}</span>
              </button>
            ))}
          </div>

          {error && (
            <p className="text-sm text-navy/70 bg-navy/5 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleForward}
              disabled={!selected || submitting}
              className="w-full py-2.5 bg-navy text-warm-white text-sm font-semibold rounded-full hover:bg-navy/90 transition-colors disabled:opacity-40"
            >
              {submitting ? 'Forwarding…' : 'Forward'}
            </button>
            <button
              onClick={onClose}
              className="text-sm text-body-grey hover:text-navy transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
