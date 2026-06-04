'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { revokeCode, generateCodeForMember } from './actions'

export type InviteCode = {
  id: string
  token: string
  owner_id: string
  owner_name: string
  created_at: string
  used_at: string | null
  used_by_name: string | null
}

export type MemberOption = {
  id: string
  name: string
}

type Filter = 'all' | 'used' | 'unused'

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active ? 'bg-navy text-warm-white border-navy' : 'bg-white text-navy border-border hover:border-navy'
      }`}
    >
      {children}
    </button>
  )
}

export default function InviteCodesClient({
  codes,
  members,
}: {
  codes: InviteCode[]
  members: MemberOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter]           = useState<Filter>('all')
  const [actionTarget, setActionTarget] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState('')
  const [generating, setGenerating]         = useState(false)
  const [lastGenerated, setLastGenerated]   = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'used')   return codes.filter(c => !!c.used_at)
    if (filter === 'unused') return codes.filter(c => !c.used_at)
    return codes
  }, [codes, filter])

  function handleRevoke(code: InviteCode) {
    if (!confirm(`Revoke code ${code.token} (owned by ${code.owner_name})? This cannot be undone.`)) return
    setActionTarget(code.id)
    startTransition(async () => {
      await revokeCode(code.id)
      router.refresh()
      setActionTarget(null)
    })
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMember) return
    setGenerating(true)
    setLastGenerated(null)
    const token = await generateCodeForMember(selectedMember)
    setLastGenerated(token)
    setGenerating(false)
    setSelectedMember('')
    router.refresh()
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-navy mb-6">Invite Codes</h1>

      {/* Generate form */}
      <div className="bg-white border border-border rounded-2xl p-5 mb-6">
        <h2 className="font-display text-base font-bold text-navy mb-3">Generate a code</h2>
        <form onSubmit={handleGenerate} className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="member-select" className="block text-xs font-medium text-body-grey mb-1.5">
              Member
            </label>
            <select
              id="member-select"
              value={selectedMember}
              onChange={e => setSelectedMember(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
            >
              <option value="">Select a member...</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!selectedMember || generating}
            className="px-5 py-2.5 bg-navy text-warm-white text-sm font-medium rounded-full hover:bg-navy/90 transition-colors disabled:opacity-40"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </form>
        {lastGenerated && (
          <p className="mt-3 text-sm font-medium text-navy">
            New code: <span className="font-mono bg-surface px-2 py-0.5 rounded">{lastGenerated}</span>
          </p>
        )}
      </div>

      {/* Filter + count */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex gap-1.5">
          <FilterBtn active={filter === 'all'}    onClick={() => setFilter('all')}>All ({codes.length})</FilterBtn>
          <FilterBtn active={filter === 'used'}   onClick={() => setFilter('used')}>Used ({codes.filter(c => !!c.used_at).length})</FilterBtn>
          <FilterBtn active={filter === 'unused'} onClick={() => setFilter('unused')}>Unused ({codes.filter(c => !c.used_at).length})</FilterBtn>
        </div>
        <p className="text-xs text-body-grey">{filtered.length} codes</p>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left">
                {['Owner', 'Code', 'Created', 'Used', 'Used by', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-body-grey uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-body-grey">
                    No codes found.
                  </td>
                </tr>
              )}
              {filtered.map(code => (
                <tr key={code.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-navy whitespace-nowrap">{code.owner_name}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-surface px-2 py-1 rounded border border-border text-navy">
                      {code.token}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-body-grey whitespace-nowrap">
                    {new Date(code.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {code.used_at ? (
                      <span className="flex items-center gap-1.5 text-green-700 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        {new Date(code.used_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    ) : (
                      <span className="text-body-grey text-xs">Unused</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-body-grey whitespace-nowrap">
                    {code.used_by_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      disabled={actionTarget === code.id && isPending}
                      onClick={() => handleRevoke(code)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
