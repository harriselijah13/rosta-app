'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import { OPEN_TO_OPTIONS, PROFILE_MODES } from '@/lib/constants'
import type { Profile } from '@/lib/types'

const OPEN_TO_MAP = Object.fromEntries(OPEN_TO_OPTIONS.map(o => [o.value, o.label]))
const MODE_MAP = Object.fromEntries(PROFILE_MODES.map(m => [m.value, m.label]))

function Initials({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const parts = name.trim().split(' ')
  const initials = parts
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const cls = size === 'sm' ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-sm'
  return (
    <div
      className={`${cls} rounded-full bg-navy/10 text-navy font-medium flex items-center justify-center shrink-0`}
    >
      {initials || '?'}
    </div>
  )
}

function MemberCard({
  member,
  isSelf,
}: {
  member: Profile
  isSelf: boolean
}) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Anonymous'
  const signal = member.signals?.[0]
  const openTo = (signal?.open_to ?? []).filter(v => v !== 'open_door')
  const hasOpenDoor = signal?.open_to?.includes('open_door') ?? false

  return (
    <Link
      href={`/profile/${member.id}`}
      className="group block bg-white border border-border rounded-2xl p-5 hover:border-navy/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3 mb-3">
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt={name}
            className="w-12 h-12 rounded-full object-cover shrink-0"
          />
        ) : (
          <Initials name={name} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-navy text-sm leading-tight">{name}</p>
            {isSelf && (
              <span className="text-xs text-body-grey">(you)</span>
            )}
            {hasOpenDoor && (
              <span className="inline-flex items-center gap-1 text-xs text-navy font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-lime inline-block" />
                Open Door
              </span>
            )}
          </div>
          {member.profile_mode && (
            <p className="text-xs text-body-grey mt-0.5">{MODE_MAP[member.profile_mode] ?? member.profile_mode}</p>
          )}
        </div>
        {member.profile_mode && (
          <Badge>{MODE_MAP[member.profile_mode] ?? member.profile_mode}</Badge>
        )}
      </div>

      {member.what_i_do && (
        <p className="text-sm text-navy mb-3 line-clamp-2">{member.what_i_do}</p>
      )}

      {openTo.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {openTo.slice(0, 4).map(v => (
            <span
              key={v}
              className="text-xs px-2 py-0.5 rounded-full bg-surface text-body-grey border border-border"
            >
              {OPEN_TO_MAP[v] ?? v}
            </span>
          ))}
          {openTo.length > 4 && (
            <span className="text-xs px-2 py-0.5 text-body-grey">
              +{openTo.length - 4}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

const FILTER_MODES = [{ value: '', label: 'All modes' }, ...PROFILE_MODES.map(m => ({ value: m.value, label: m.label }))]
const FILTER_OPEN_TO = [{ value: '', label: 'Any signal' }, ...OPEN_TO_OPTIONS]

export default function MemberDirectory({
  members,
  currentUserId,
}: {
  members: Profile[]
  currentUserId: string
}) {
  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [openToFilter, setOpenToFilter] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return members.filter(m => {
      const name = `${m.first_name ?? ''} ${m.last_name ?? ''}`.toLowerCase()
      const what = (m.what_i_do ?? '').toLowerCase()
      const location = (m.where_i_operate ?? '').toLowerCase()
      if (q && !name.includes(q) && !what.includes(q) && !location.includes(q)) return false
      if (modeFilter && m.profile_mode !== modeFilter) return false
      const memberOpenTo = m.signals?.[0]?.open_to ?? []
      if (openToFilter && !memberOpenTo.includes(openToFilter)) return false
      return true
    })
  }, [members, search, modeFilter, openToFilter])

  const hasFilters = search || modeFilter || openToFilter

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-navy mb-1">Members</h1>
        <p className="text-body-grey">
          {members.length} {members.length === 1 ? 'person' : 'people'} in the network
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-4 mb-8">
        <input
          type="text"
          placeholder="Search by name, role, or location..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-3 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors text-sm"
        />

        <div className="flex flex-wrap gap-2 items-center">
          {/* Profile mode filter */}
          <div className="flex flex-wrap gap-1.5">
            {FILTER_MODES.map(m => (
              <button
                key={m.value}
                onClick={() => setModeFilter(m.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  modeFilter === m.value
                    ? 'bg-navy text-warm-white border-navy'
                    : 'bg-white text-navy border-border hover:border-navy'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Open to filter */}
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPEN_TO.map(o => (
              <button
                key={o.value}
                onClick={() => setOpenToFilter(o.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  openToFilter === o.value
                    ? 'bg-navy text-warm-white border-navy'
                    : 'bg-white text-navy border-border hover:border-navy'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setModeFilter(''); setOpenToFilter('') }}
              className="text-xs text-body-grey hover:text-navy transition-colors ml-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {hasFilters && (
        <p className="text-sm text-body-grey mb-5">
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </p>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => (
            <MemberCard key={m.id} member={m} isSelf={m.id === currentUserId} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center">
          <p className="text-navy font-medium mb-1">No members found</p>
          <p className="text-body-grey text-sm">Try adjusting your filters</p>
        </div>
      )}
    </div>
  )
}
