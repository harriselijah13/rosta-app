'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type Member = {
  id: string
  name: string
  avatarUrl: string | null
  whatIDo: string | null
}

type Edge = { user_a: string; user_b: string }

function Avatar({ member }: { member: Member }) {
  const initials = member.name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?'
  if (member.avatarUrl) {
    return <img src={member.avatarUrl} alt={member.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
  }
  return (
    <div className="w-9 h-9 rounded-full bg-navy/10 text-navy text-sm font-semibold flex items-center justify-center shrink-0">
      {initials}
    </div>
  )
}

function SelectedCard({ member, onClear }: { member: Member; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-navy/25 rounded-xl">
      <Avatar member={member} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy truncate">{member.name}</p>
        {member.whatIDo && <p className="text-xs text-body-grey truncate">{member.whatIDo}</p>}
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${member.name}`}
        className="shrink-0 p-1 text-body-grey/50 hover:text-navy transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function MemberPicker({
  members,
  search,
  onSearch,
  onSelect,
  emptyMessage = 'No connections match your search.',
}: {
  members: Member[]
  search: string
  onSearch: (v: string) => void
  onSelect: (m: Member) => void
  emptyMessage?: string
}) {
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return q ? members.filter(m => m.name.toLowerCase().includes(q)) : members
  }, [members, search])

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className="p-3 border-b border-border">
        <input
          type="text"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search by name…"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className="w-full text-sm text-navy placeholder-body-grey bg-surface px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
        />
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-border">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-body-grey text-center">{emptyMessage}</p>
        ) : (
          filtered.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m)}
              className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-surface transition-colors"
            >
              <Avatar member={m} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy">{m.name}</p>
                {m.whatIDo && <p className="text-xs text-body-grey truncate">{m.whatIDo}</p>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default function SuggestForm({
  connections,
  edges,
}: {
  connections: Member[]
  edges: Edge[]
}) {
  const [memberA, setMemberA] = useState<Member | null>(null)
  const [memberB, setMemberB] = useState<Member | null>(null)
  const [searchA, setSearchA] = useState('')
  const [searchB, setSearchB] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const connectedTo = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const { user_a, user_b } of edges) {
      if (!map[user_a]) map[user_a] = new Set()
      if (!map[user_b]) map[user_b] = new Set()
      map[user_a].add(user_b)
      map[user_b].add(user_a)
    }
    return map
  }, [edges])

  const bCandidates = useMemo(() => {
    if (!memberA) return []
    const aConns = connectedTo[memberA.id] ?? new Set<string>()
    return connections.filter(m => m.id !== memberA.id && !aConns.has(m.id))
  }, [memberA, connections, connectedTo])

  function clearA() {
    setMemberA(null)
    setMemberB(null)
    setSearchA('')
    setSearchB('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!memberA || !memberB) return
    if (!note.trim()) { setError('Add a note explaining why these two should meet.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/intros/facilitate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberAId: memberA.id, memberBId: memberB.id, note }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      setDone(true)
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (done && memberA && memberB) {
    return (
      <div className="bg-white border border-border rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-navy mb-2">Suggestion sent</h2>
        <p className="text-sm text-body-grey mb-6">
          Both {memberA.name} and {memberB.name} have been emailed and can accept or decline.
        </p>
        <Link href="/intro" className="text-sm font-medium text-navy hover:underline underline-offset-2">
          Back to intros
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Step 1 — first person */}
      <div>
        <p className="text-xs font-semibold text-body-grey uppercase tracking-wide mb-2">First person</p>
        {memberA ? (
          <SelectedCard member={memberA} onClear={clearA} />
        ) : (
          <MemberPicker
            members={connections}
            search={searchA}
            onSearch={setSearchA}
            onSelect={m => { setMemberA(m); setSearchA('') }}
            emptyMessage="No connections match your search."
          />
        )}
      </div>

      {/* Step 2 — second person (revealed after A is picked) */}
      {memberA && (
        <div>
          <p className="text-xs font-semibold text-body-grey uppercase tracking-wide mb-2">Second person</p>
          {memberB ? (
            <SelectedCard member={memberB} onClear={() => { setMemberB(null); setSearchB('') }} />
          ) : bCandidates.length === 0 ? (
            <div className="bg-white border border-border rounded-xl px-4 py-6 text-center">
              <p className="text-sm text-body-grey">
                All your connections already know {memberA.name} — there&apos;s no one new to introduce them to.
              </p>
            </div>
          ) : (
            <MemberPicker
              members={bCandidates}
              search={searchB}
              onSearch={setSearchB}
              onSelect={m => { setMemberB(m); setSearchB('') }}
              emptyMessage="No connections match your search."
            />
          )}
        </div>
      )}

      {/* Step 3 — note and submit (revealed after both are picked) */}
      {memberA && memberB && (
        <>
          <div className="bg-white border border-border rounded-2xl p-5">
            <label htmlFor="note" className="font-display text-base font-bold text-navy block mb-1">
              Why should these two meet?
            </label>
            <p className="text-sm text-body-grey mb-3">
              Write a short note putting them both in context. Both will see it.
            </p>
            <textarea
              id="note"
              rows={4}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. You're both building in fintech and I think you'd spark something interesting."
              className="w-full px-4 py-3 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors text-sm resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-body-grey bg-surface border border-border px-4 py-3 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !note.trim()}
            className="w-full py-3 bg-navy text-warm-white text-sm font-semibold rounded-full hover:bg-navy/90 transition-colors disabled:opacity-40"
          >
            {loading ? 'Making the introduction…' : 'Make the introduction'}
          </button>
        </>
      )}
    </form>
  )
}
