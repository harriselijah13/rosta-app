'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setFoundingMember, generateInviteCode, removeMember, grantVerification, removeVerification } from './actions'
import MemberActionsMenu from './MemberActionsMenu'

export type OpenDoorStatus = 'on' | 'off' | 'no_signals'

export type AdminMember = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  username: string | null
  where_i_operate: string | null
  founding_member: boolean
  created_at: string
  last_active_at: string | null
  is_complete: boolean
  is_verified: boolean
  onboarding_completed: boolean
  open_door: OpenDoorStatus
}

const PAGE_SIZE = 50

type FilterActive   = 'all' | 'active'     | 'inactive'
type FilterFounding = 'all' | 'yes'        | 'no'
type FilterComplete = 'all' | 'yes'        | 'no'
type FilterVerified = 'all' | 'verified'   | 'unverified'
type FilterOnboarded = 'all' | 'complete'  | 'incomplete'

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 2)   return 'Just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

function isActiveNow(lastActive: string | null): boolean {
  if (!lastActive) return false
  return Date.now() - new Date(lastActive).getTime() < 14 * 24 * 60 * 60 * 1000
}

function fullName(m: AdminMember): string {
  return [m.first_name, m.last_name].filter(Boolean).join(' ') || '—'
}

function exportCsv(rows: AdminMember[]) {
  const headers = ['Name', 'Email', 'Joined', 'Location', 'Founding', 'Verified', 'Last active', 'Complete', 'Onboarded']
  const lines = rows.map(m => [
    fullName(m),
    m.email,
    new Date(m.created_at).toLocaleDateString('en-GB'),
    m.where_i_operate ?? '',
    m.founding_member ? 'Yes' : 'No',
    m.is_verified ? 'Yes' : 'No',
    m.last_active_at ? new Date(m.last_active_at).toLocaleDateString('en-GB') : 'Never',
    m.is_complete ? 'Yes' : 'No',
    m.onboarding_completed ? 'Yes' : 'No',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

  const csv  = [headers.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `rosta-members-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function FilterBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

export default function MembersClient({ members }: { members: AdminMember[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search,          setSearch]         = useState('')
  const [filterFounding,  setFilterFounding]  = useState<FilterFounding>('all')
  const [filterActive,    setFilterActive]    = useState<FilterActive>('all')
  const [filterComplete,  setFilterComplete]  = useState<FilterComplete>('all')
  const [filterVerified,   setFilterVerified]   = useState<FilterVerified>('all')
  const [filterOnboarded,  setFilterOnboarded]  = useState<FilterOnboarded>('all')
  const [page,             setPage]             = useState(0)
  const [actionTarget,    setActionTarget]    = useState<string | null>(null)
  // Track admin-granted verifications this session so the row updates immediately
  const [grantedIds, setGrantedIds] = useState<Set<string>>(new Set())
  // Track admin-removed verifications this session so the row updates immediately
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  // Optimistic open-door overrides (populated on per-member toggles, cleared on bulk refresh)
  const [openDoorOverrides, setOpenDoorOverrides] = useState<Record<string, 'on' | 'off'>>({})
  // Bulk open-door modal state
  const [bulkModal, setBulkModal] = useState<{ enabled: boolean; affectedCount: number } | null>(null)
  const [bulkPending, setBulkPending] = useState(false)
  // Toast message
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(null), 4000)
    return () => clearTimeout(t)
  }, [toastMsg])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter(m => {
      if (q) {
        const name = fullName(m).toLowerCase()
        if (!name.includes(q) && !m.email.toLowerCase().includes(q)) return false
      }
      if (filterFounding === 'yes' && !m.founding_member) return false
      if (filterFounding === 'no'  &&  m.founding_member) return false
      const active = isActiveNow(m.last_active_at)
      if (filterActive === 'active'   && !active) return false
      if (filterActive === 'inactive' &&  active) return false
      if (filterComplete === 'yes' && !m.is_complete) return false
      if (filterComplete === 'no'  &&  m.is_complete) return false
      const isVerified = (m.is_verified && !removedIds.has(m.id)) || grantedIds.has(m.id)
      if (filterVerified === 'verified'   && !isVerified) return false
      if (filterVerified === 'unverified' &&  isVerified) return false
      if (filterOnboarded === 'complete'   && !m.onboarding_completed) return false
      if (filterOnboarded === 'incomplete' &&  m.onboarding_completed) return false
      return true
    })
  }, [members, search, filterFounding, filterActive, filterComplete, filterVerified, filterOnboarded, grantedIds, removedIds])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function resetPage() { setPage(0) }

  async function handleFoundingToggle(m: AdminMember) {
    setActionTarget(m.id)
    startTransition(async () => {
      await setFoundingMember(m.id, !m.founding_member)
      router.refresh()
      setActionTarget(null)
    })
  }

  async function handleGenerateCode(m: AdminMember) {
    setActionTarget(m.id)
    startTransition(async () => {
      const token = await generateInviteCode(m.id)
      setActionTarget(null)
      alert(`New invite code for ${fullName(m)}: ${token}`)
    })
  }

  async function handleRemove(m: AdminMember) {
    if (!confirm(`Remove ${fullName(m)} (${m.email}) from ROSTA? This cannot be undone.`)) return
    setActionTarget(m.id)
    startTransition(async () => {
      await removeMember(m.id)
      router.refresh()
      setActionTarget(null)
    })
  }

  // ── Open Door helpers ────────────────────────────────────────────────────────

  function effectiveOpenDoor(m: AdminMember): OpenDoorStatus {
    if (m.open_door === 'no_signals') return 'no_signals'
    return openDoorOverrides[m.id] ?? m.open_door
  }

  async function handleOpenDoorToggle(m: AdminMember) {
    const current = effectiveOpenDoor(m)
    if (current === 'no_signals') return
    const newEnabled = current !== 'on'
    // Optimistic update
    setOpenDoorOverrides(prev => ({ ...prev, [m.id]: newEnabled ? 'on' : 'off' }))
    try {
      const res = await fetch(`/api/admin/members/${m.id}/open-door`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      })
      if (!res.ok) throw new Error('Toggle failed')
    } catch {
      // Revert on failure
      setOpenDoorOverrides(prev => ({ ...prev, [m.id]: newEnabled ? 'off' : 'on' }))
    }
  }

  function openBulkModal(enabled: boolean) {
    const affectedCount = members.filter(m => {
      const s = effectiveOpenDoor(m)
      return s !== 'no_signals' && (enabled ? s === 'off' : s === 'on')
    }).length
    setBulkModal({ enabled, affectedCount })
  }

  async function handleBulkConfirm() {
    if (!bulkModal) return
    setBulkPending(true)
    try {
      const res = await fetch('/api/admin/members/open-door/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: bulkModal.enabled }),
      })
      if (!res.ok) throw new Error('Bulk update failed')
      setBulkModal(null)
      setOpenDoorOverrides({})
      router.refresh()
    } catch (err) {
      console.error('[bulk open-door]', err)
      setBulkModal(null)
    } finally {
      setBulkPending(false)
    }
  }

  // ────────────────────────────────────────────────────────────────────────────

  async function handleGrantVerification(m: AdminMember) {
    if (!confirm(`Grant verified status to ${fullName(m)}? They will receive a "You're now verified" email immediately.`)) return
    setActionTarget(m.id)
    startTransition(async () => {
      await grantVerification(m.id)
      setGrantedIds(prev => { const next = new Set(prev); next.add(m.id); return next })
      setActionTarget(null)
    })
  }

  async function handleRemoveVerification(m: AdminMember) {
    setActionTarget(m.id)
    startTransition(async () => {
      await removeVerification(m.id)
      setRemovedIds(prev => { const next = new Set(prev); next.add(m.id); return next })
      setToastMsg(`Verification removed from ${fullName(m)}.`)
      setActionTarget(null)
    })
  }

  return (
    <div>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-navy text-warm-white text-sm font-medium px-5 py-3 rounded-full shadow-lg pointer-events-none">
          {toastMsg}
        </div>
      )}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="font-display text-3xl font-bold text-navy">
          Members
          <span className="ml-2 text-base font-sans font-normal text-body-grey">
            {filtered.length} of {members.length}
          </span>
        </h1>
        <button
          onClick={() => exportCsv(filtered)}
          className="text-xs font-medium border border-border text-navy px-4 py-2 rounded-full hover:border-navy transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={e => { setSearch(e.target.value); resetPage() }}
        className="w-full max-w-md px-4 py-3 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors text-sm mb-4"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1.5">
          <FilterBtn active={filterFounding === 'all'} onClick={() => { setFilterFounding('all'); resetPage() }}>All</FilterBtn>
          <FilterBtn active={filterFounding === 'yes'} onClick={() => { setFilterFounding('yes'); resetPage() }}>Founding</FilterBtn>
          <FilterBtn active={filterFounding === 'no'}  onClick={() => { setFilterFounding('no');  resetPage() }}>Non-founding</FilterBtn>
        </div>
        <div className="w-px bg-border mx-1" />
        <div className="flex gap-1.5">
          <FilterBtn active={filterActive === 'all'}      onClick={() => { setFilterActive('all');      resetPage() }}>All activity</FilterBtn>
          <FilterBtn active={filterActive === 'active'}   onClick={() => { setFilterActive('active');   resetPage() }}>Active</FilterBtn>
          <FilterBtn active={filterActive === 'inactive'} onClick={() => { setFilterActive('inactive'); resetPage() }}>Inactive</FilterBtn>
        </div>
        <div className="w-px bg-border mx-1" />
        <div className="flex gap-1.5">
          <FilterBtn active={filterComplete === 'all'} onClick={() => { setFilterComplete('all'); resetPage() }}>All profiles</FilterBtn>
          <FilterBtn active={filterComplete === 'yes'} onClick={() => { setFilterComplete('yes'); resetPage() }}>Complete</FilterBtn>
          <FilterBtn active={filterComplete === 'no'}  onClick={() => { setFilterComplete('no');  resetPage() }}>Incomplete</FilterBtn>
        </div>
        <div className="w-px bg-border mx-1" />
        <div className="flex gap-1.5">
          <FilterBtn active={filterVerified === 'all'}        onClick={() => { setFilterVerified('all');        resetPage() }}>All verification</FilterBtn>
          <FilterBtn active={filterVerified === 'verified'}   onClick={() => { setFilterVerified('verified');   resetPage() }}>Verified</FilterBtn>
          <FilterBtn active={filterVerified === 'unverified'} onClick={() => { setFilterVerified('unverified'); resetPage() }}>Unverified</FilterBtn>
        </div>
        <div className="w-px bg-border mx-1" />
        <div className="flex gap-1.5">
          <FilterBtn active={filterOnboarded === 'all'}        onClick={() => { setFilterOnboarded('all');        resetPage() }}>All onboarding</FilterBtn>
          <FilterBtn active={filterOnboarded === 'complete'}   onClick={() => { setFilterOnboarded('complete');   resetPage() }}>Onboarded</FilterBtn>
          <FilterBtn active={filterOnboarded === 'incomplete'} onClick={() => { setFilterOnboarded('incomplete'); resetPage() }}>Incomplete</FilterBtn>
        </div>
      </div>

      {/* Bulk Open Door controls */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <span className="text-xs font-medium text-body-grey mr-1">Bulk Open Door:</span>
        <button
          onClick={() => openBulkModal(true)}
          className="text-xs font-medium border border-border text-navy px-3 py-1.5 rounded-full hover:border-navy transition-colors"
        >
          Turn all ON
        </button>
        <button
          onClick={() => openBulkModal(false)}
          className="text-xs font-medium border border-border text-navy px-3 py-1.5 rounded-full hover:border-navy transition-colors"
        >
          Turn all OFF
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left">
                {['Name', 'Email', 'Joined', 'Location', 'Open Door', 'Last active', 'Complete', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-body-grey uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {currentPage.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-body-grey">
                    No members match your filters.
                  </td>
                </tr>
              )}
              {currentPage.map(m => {
                const active      = isActiveNow(m.last_active_at)
                const loading     = actionTarget === m.id && isPending
                const isVerified  = (m.is_verified && !removedIds.has(m.id)) || grantedIds.has(m.id)
                const profileHref = `/profile/${m.username ?? m.id}`

                return (
                  <tr key={m.id} className={`hover:bg-surface/50 transition-colors ${!m.onboarding_completed ? 'bg-amber-50/40' : ''}`}>
                    {/* Name */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={profileHref} className="font-medium text-navy hover:underline">
                        {fullName(m)}
                      </Link>
                      {m.founding_member && (
                        <span className="ml-2 text-[10px] font-semibold bg-lime/30 border border-lime/50 text-navy px-1.5 py-0.5 rounded-full">
                          Founding
                        </span>
                      )}
                      {isVerified && (
                        <span
                          title="Verified ROSTA member"
                          className="ml-1.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-lime shrink-0"
                        >
                          <svg viewBox="0 0 20 20" fill="none" className="w-2.5 h-2.5">
                            <path d="M5 10.5l3 3 7-7" stroke="#0F1B3C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                      {!m.onboarding_completed && (
                        <span className="ml-2 text-[10px] font-semibold bg-amber-100 border border-amber-300 text-amber-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          Setup incomplete
                        </span>
                      )}
                    </td>
                    {/* Email */}
                    <td className="px-4 py-3 text-body-grey whitespace-nowrap">{m.email}</td>
                    {/* Joined */}
                    <td className="px-4 py-3 text-body-grey whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    {/* Location */}
                    <td className="px-4 py-3 text-body-grey whitespace-nowrap max-w-[140px] truncate">
                      {m.where_i_operate ?? '—'}
                    </td>
                    {/* Open Door */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(() => {
                        const s = effectiveOpenDoor(m)
                        if (s === 'no_signals') {
                          return <span className="text-xs text-body-grey">—</span>
                        }
                        return (
                          <button
                            onClick={() => handleOpenDoorToggle(m)}
                            title={s === 'on' ? 'Open Door ON — click to turn off' : 'Open Door OFF — click to turn on'}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 ${
                              s === 'on' ? 'bg-lime' : 'bg-border'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${
                                s === 'on' ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        )
                      })()}
                    </td>
                    {/* Last active */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`flex items-center gap-1.5 ${active ? 'text-navy' : 'text-body-grey'}`}>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                        {relativeTime(m.last_active_at)}
                      </span>
                    </td>
                    {/* Complete */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-medium ${m.is_complete ? 'text-green-700' : 'text-body-grey'}`}>
                        {m.is_complete ? 'Yes' : 'No'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <MemberActionsMenu
                        member={m}
                        isVerified={isVerified}
                        isLoading={loading}
                        onFoundingToggle={() => handleFoundingToggle(m)}
                        onGrantVerification={() => handleGrantVerification(m)}
                        onRemoveVerification={() => handleRemoveVerification(m)}
                        onGenerateCode={() => handleGenerateCode(m)}
                        onRemove={() => handleRemove(m)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-body-grey">
              Page {page + 1} of {totalPages} — {filtered.length} members
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="text-xs px-3 py-1.5 border border-border rounded-full hover:border-navy transition-colors disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="text-xs px-3 py-1.5 border border-border rounded-full hover:border-navy transition-colors disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Bulk Open Door confirmation modal */}
      {bulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <h2 className="font-display text-lg font-bold text-navy mb-2">
              Turn Open Door {bulkModal.enabled ? 'ON' : 'OFF'}
            </h2>
            <p className="text-sm text-body-grey mb-6">
              {bulkModal.affectedCount === 0
                ? `All members with signals already have Open Door ${bulkModal.enabled ? 'ON' : 'OFF'}. Nothing to change.`
                : `Turn Open Door ${bulkModal.enabled ? 'ON' : 'OFF'} for ${bulkModal.affectedCount} member${bulkModal.affectedCount === 1 ? '' : 's'} who currently ${bulkModal.enabled ? 'have it OFF' : 'have it ON'}?`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkModal(null)}
                disabled={bulkPending}
                className="text-sm font-medium border border-border text-navy px-4 py-2 rounded-full hover:border-navy transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              {bulkModal.affectedCount > 0 && (
                <button
                  onClick={handleBulkConfirm}
                  disabled={bulkPending}
                  className="text-sm font-medium bg-navy text-white px-4 py-2 rounded-full hover:bg-navy/90 transition-colors disabled:opacity-40"
                >
                  {bulkPending ? 'Updating…' : 'Confirm'}
                </button>
              )}
              {bulkModal.affectedCount === 0 && (
                <button
                  onClick={() => setBulkModal(null)}
                  className="text-sm font-medium bg-navy text-white px-4 py-2 rounded-full hover:bg-navy/90 transition-colors"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
