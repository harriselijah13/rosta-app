'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import { OPEN_TO_OPTIONS, PROFILE_MODES } from '@/lib/constants'
import type { Profile } from '@/lib/types'

const OPEN_TO_MAP = Object.fromEntries(OPEN_TO_OPTIONS.map(o => [o.value, o.label]))
const MODE_MAP    = Object.fromEntries(PROFILE_MODES.map(m => [m.value, m.label]))

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(m: Profile): string {
  return [m.first_name?.[0], m.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
}

function isActive(m: Profile): boolean {
  const ref = m.signals?.[0]?.updated_at ?? m.updated_at
  return Date.now() - new Date(ref).getTime() < 14 * 24 * 60 * 60 * 1000
}

function matchesLocation(loc: string, filter: string): boolean {
  if (!filter) return true
  const l = loc.toLowerCase()
  if (filter === 'UAE')   return l.includes('uae')
  if (filter === 'UK')    return l.endsWith(', uk')
  if (filter === 'other') return !!loc.trim() && !l.includes('uae') && !l.endsWith(', uk')
  return l.includes(filter.toLowerCase())
}

function applyFilters(
  members: Profile[],
  search: string,
  location: string,
  mode: string,
  openTo: string,
): Profile[] {
  const q = search.toLowerCase()
  return members.filter(m => {
    if (q) {
      const name = `${m.first_name ?? ''} ${m.last_name ?? ''}`.toLowerCase()
      const what = (m.what_i_do ?? '').toLowerCase()
      const loc  = (m.where_i_operate ?? '').toLowerCase()
      if (!name.includes(q) && !what.includes(q) && !loc.includes(q)) return false
    }
    if (!matchesLocation(m.where_i_operate ?? '', location)) return false
    if (mode  && m.profile_mode !== mode) return false
    if (openTo && !(m.signals?.[0]?.open_to ?? []).includes(openTo)) return false
    return true
  })
}

const STOPWORDS = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'will', 'they', 'your', 'into', 'more', 'need', 'want', 'help', 'some', 'what', 'looking', 'right', 'now'])

function keywords(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOPWORDS.has(w))
}

function computeSuggestions(current: Profile | undefined, pool: Profile[], max: number): Profile[] {
  if (!current) return []
  const myLoc     = (current.where_i_operate ?? '').toLowerCase()
  const mySignal  = current.signals?.[0]
  const myNeed    = keywords(mySignal?.need_right_now ?? '')
  const myWorking = keywords(mySignal?.working_on ?? '')
  if (!myLoc && myNeed.length === 0 && myWorking.length === 0) return []

  return pool
    .map(m => {
      let score = 0
      const theirLoc     = (m.where_i_operate ?? '').toLowerCase()
      const theirSignal  = m.signals?.[0]
      const theirWorking = keywords(theirSignal?.working_on ?? '')
      const theirNeed    = keywords(theirSignal?.need_right_now ?? '')

      if (myLoc && theirLoc) {
        if (myLoc === theirLoc) score += 3
        else {
          const myCountry    = myLoc.split(',').pop()?.trim()
          const theirCountry = theirLoc.split(',').pop()?.trim()
          if (myCountry && theirCountry && myCountry === theirCountry) score += 2
        }
      }
      for (const w of myNeed)    if (theirWorking.includes(w)) score++
      for (const w of theirNeed) if (myWorking.includes(w))    score++

      return { m, score }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(s => s.m)
}

// ── ActiveDot + Avatar helpers ─────────────────────────────────────────────────

function ActiveDot({ active }: { active: boolean }) {
  return (
    <span
      title={active ? 'Active on ROSTA' : 'Inactive'}
      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
        active ? 'bg-green-500' : 'bg-body-grey/30'
      }`}
    />
  )
}

function Avatar({ member }: { member: Profile }) {
  const name   = [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Anonymous'
  const active = isActive(member)
  if (member.avatar_url) {
    return (
      <div className="relative shrink-0">
        <img src={member.avatar_url} alt={name} className="w-12 h-12 rounded-full object-cover" />
        <ActiveDot active={active} />
      </div>
    )
  }
  const ini = initials(member)
  return (
    <div className="relative shrink-0">
      <div className="w-12 h-12 text-sm rounded-full bg-navy/10 text-navy font-medium flex items-center justify-center">
        {ini}
      </div>
      <ActiveDot active={active} />
    </div>
  )
}

// ── MemberCard ─────────────────────────────────────────────────────────────────

function MemberCard({ member, isSelf, isConnected }: { member: Profile; isSelf: boolean; isConnected: boolean }) {
  const name       = [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Anonymous'
  const signal     = member.signals?.[0]
  const openTo     = (signal?.open_to ?? []).filter(v => v !== 'open_door')
  const hasOpenDoor = signal?.open_to?.includes('open_door') ?? false

  return (
    <Link
      href={`/profile/${member.username ?? member.id}`}
      className="group block bg-white border border-border rounded-2xl p-5 hover:border-navy/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3 mb-3">
        <Avatar member={member} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-navy text-sm leading-tight">{name}</p>
            {member.is_verified && <VerifiedBadge />}
            {isSelf && <span className="text-xs text-body-grey">(you)</span>}
            {isConnected && !isSelf && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-navy bg-navy/5 border border-navy/20 px-1.5 py-0.5 rounded-full">
                Connected
              </span>
            )}
            {member.founding_member && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-navy bg-lime/30 border border-lime/50 px-1.5 py-0.5 rounded-full">
                Founding
              </span>
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
      {(isConnected || isSelf) && member.building_now && (
        <p className="text-xs text-body-grey mb-3 line-clamp-1">
          <span className="font-medium text-navy">Building: </span>{member.building_now}
        </p>
      )}
      {openTo.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {openTo.slice(0, 4).map(v => (
            <span key={v} className="text-xs px-2 py-0.5 rounded-full bg-surface text-body-grey border border-border">
              {OPEN_TO_MAP[v] ?? v}
            </span>
          ))}
          {openTo.length > 4 && <span className="text-xs px-2 py-0.5 text-body-grey">+{openTo.length - 4}</span>}
        </div>
      )}
    </Link>
  )
}

// ── Network web graphic ────────────────────────────────────────────────────────

const GHOST_COUNT = 7

function NetworkWeb({ current, connections, onBrowse }: { current: Profile | undefined; connections: Profile[]; onBrowse: () => void }) {
  const isEmpty    = connections.length === 0
  const visible    = connections.slice(0, 12)
  const extraCount = connections.length - 12
  const cx = 200, cy = 150, R = 110

  // Real node positions, or ghost positions when empty
  const nodeCount = isEmpty ? GHOST_COUNT : visible.length
  const positions = Array.from({ length: nodeCount }, (_, i) => {
    const angle = (i / nodeCount) * 2 * Math.PI - Math.PI / 2
    return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) }
  })

  const myIni = current ? initials(current) : '?'

  return (
    <div className="flex flex-col items-center mb-6 select-none">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes rosta-drift {
            0%, 100% { transform: translateY(0px); }
            50%       { transform: translateY(-6px); }
          }
        }
      `}</style>

      <svg viewBox="0 0 400 300" className="w-full max-w-sm sm:max-w-md" aria-hidden="true">
        {/* Spoke lines — dashed for ghost state */}
        {positions.map((pos, i) => (
          <line
            key={`l-${i}`}
            x1={cx} y1={cy} x2={pos.x} y2={pos.y}
            stroke="#E5E1DB"
            strokeWidth="1.5"
            strokeDasharray={isEmpty ? '4 4' : undefined}
          />
        ))}

        {/* Ghost nodes (empty state) */}
        {isEmpty && positions.map((pos, i) => {
          const dur   = `${22 + (i % 5) * 4}s`
          const delay = `${(i * 2.5).toFixed(1)}s`
          return (
            <g key={`ghost-${i}`} style={{ animation: `rosta-drift ${dur} ease-in-out ${delay} infinite` }}>
              <circle cx={pos.x} cy={pos.y} r="22" fill="#0F1B3C" opacity="0.2" />
            </g>
          )
        })}

        {/* Real connection nodes */}
        {!isEmpty && visible.map((m, i) => {
          const { x, y } = positions[i]
          const dur   = `${22 + (i % 5) * 4}s`
          const delay = `${(i * 2.5).toFixed(1)}s`
          return (
            <g key={m.id} style={{ animation: `rosta-drift ${dur} ease-in-out ${delay} infinite` }}>
              <circle cx={x} cy={y} r="22" fill="#0F1B3C" opacity="0.82" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="10" fontWeight="600">
                {initials(m)}
              </text>
            </g>
          )
        })}

        {/* Centre node — always shown */}
        <circle cx={cx} cy={cy} r="30" fill="#0F1B3C" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#C8F53C" fontSize="12" fontWeight="700">
          {myIni}
        </text>

        {!isEmpty && extraCount > 0 && (
          <text x={390} y={290} textAnchor="end" fill="#6B7280" fontSize="11">
            +{extraCount} more
          </text>
        )}
      </svg>

      {/* Empty-state prompt — two lines only, no card */}
      {isEmpty && (
        <div className="text-center mt-1">
          <p className="font-display font-bold text-navy text-lg mb-1">Your network starts here.</p>
          <button
            onClick={onBrowse}
            className="text-sm text-body-grey hover:text-navy transition-colors"
          >
            Find people worth knowing.
          </button>
        </div>
      )}
    </div>
  )
}

// ── Location filter select ─────────────────────────────────────────────────────

function LocationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
    >
      <option value="">All locations</option>
      <option value="UAE">UAE</option>
      <option value="UK">UK</option>
      <optgroup label="UAE cities">
        <option value="Dubai">Dubai</option>
        <option value="Sharjah">Sharjah</option>
        <option value="Abu Dhabi">Abu Dhabi</option>
        <option value="Ras Al Khaimah">Ras Al Khaimah</option>
      </optgroup>
      <optgroup label="UK cities">
        <option value="London">London</option>
        <option value="Manchester">Manchester</option>
        <option value="Liverpool">Liverpool</option>
        <option value="Bristol">Bristol</option>
        <option value="Birmingham">Birmingham</option>
        <option value="Newcastle">Newcastle</option>
      </optgroup>
      <option value="other">Other</option>
    </select>
  )
}

// ── Filter pill rows (mode + openTo — Tab 2 only) ──────────────────────────────

const FILTER_MODES   = [{ value: '', label: 'All modes' },   ...PROFILE_MODES.map(m => ({ value: m.value, label: m.label }))]
const FILTER_OPEN_TO = [{ value: '', label: 'Any signal' }, ...OPEN_TO_OPTIONS]

// ── Main export ────────────────────────────────────────────────────────────────

export default function MemberDirectory({
  members,
  currentUserId,
  connectedUserIds,
}: {
  members: Profile[]
  currentUserId: string
  connectedUserIds: string[]
}) {
  const [tab,          setTab]          = useState<'network' | 'members'>('network')
  const [search,       setSearch]       = useState('')
  const [locationFilter, setLocation]  = useState('')
  const [modeFilter,   setMode]         = useState('')
  const [openToFilter, setOpenTo]       = useState('')

  const connectedSet = useMemo(() => new Set(connectedUserIds), [connectedUserIds])

  const currentUser      = useMemo(() => members.find(m => m.id === currentUserId), [members, currentUserId])
  const connectedMembers = useMemo(() => members.filter(m => connectedSet.has(m.id)), [members, connectedSet])
  const discoverMembers  = useMemo(
    () => members.filter(m => m.id !== currentUserId && !connectedSet.has(m.id)),
    [members, currentUserId, connectedSet],
  )
  const suggestions = useMemo(
    () => computeSuggestions(currentUser, discoverMembers, 4),
    [currentUser, discoverMembers],
  )

  const filteredConnected = useMemo(
    () => applyFilters(connectedMembers, search, locationFilter, '', ''),
    [connectedMembers, search, locationFilter],
  )
  const filteredDiscover = useMemo(
    () => applyFilters(discoverMembers, search, locationFilter, modeFilter, openToFilter),
    [discoverMembers, search, locationFilter, modeFilter, openToFilter],
  )

  const hasFilters = search || locationFilter || modeFilter || openToFilter

  function clearFilters() {
    setSearch(''); setLocation(''); setMode(''); setOpenTo('')
  }

  // Shared search + location bar
  function FilterBar({ showAdvanced = false }: { showAdvanced?: boolean }) {
    return (
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search by name or role…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-4 py-2.5 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors text-sm"
          />
          <LocationSelect value={locationFilter} onChange={setLocation} />
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-body-grey hover:text-navy transition-colors px-2">
              Clear
            </button>
          )}
        </div>

        {showAdvanced && (
          <div className="flex flex-wrap gap-2 items-center overflow-x-auto pb-1">
            <div className="flex flex-wrap gap-1.5">
              {FILTER_MODES.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    modeFilter === m.value ? 'bg-navy text-warm-white border-navy' : 'bg-white text-navy border-border hover:border-navy'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-border mx-1" />
            <div className="flex flex-wrap gap-1.5">
              {FILTER_OPEN_TO.map(o => (
                <button
                  key={o.value}
                  onClick={() => setOpenTo(o.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    openToFilter === o.value ? 'bg-navy text-warm-white border-navy' : 'bg-white text-navy border-border hover:border-navy'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-display text-4xl font-bold text-navy">Members</h1>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border mb-8">
        <div className="flex gap-8">
          {([['network', 'My Network'], ['members', 'Members']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-3 text-sm font-medium transition-colors ${
                tab === key
                  ? 'text-navy border-b-2 border-navy -mb-px'
                  : 'text-body-grey hover:text-navy'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab 1: My Network ── */}
      {tab === 'network' && (
        <>
          <NetworkWeb
            current={currentUser}
            connections={connectedMembers}
            onBrowse={() => setTab('members')}
          />

          {connectedMembers.length > 0 && (
            <>
              <FilterBar />
              <p className="text-sm text-body-grey mb-5">
                {filteredConnected.length}{' '}
                {filteredConnected.length === 1 ? 'connection' : 'connections'}
                {(search || locationFilter) && ' matching your filters'}
              </p>
              {filteredConnected.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredConnected.map(m => (
                    <MemberCard key={m.id} member={m} isSelf={false} isConnected />
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <p className="text-navy font-medium mb-1">No connections match</p>
                  <p className="text-body-grey text-sm">Try adjusting your filters</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Tab 2: Members ── */}
      {tab === 'members' && (
        <>
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-body-grey mb-3">
                Suggested for you
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {suggestions.map(m => (
                  <MemberCard key={m.id} member={m} isSelf={false} isConnected={false} />
                ))}
              </div>
              <div className="mt-8 border-t border-border" />
            </div>
          )}

          <FilterBar showAdvanced />

          <p className="text-sm text-body-grey mb-5">
            {hasFilters
              ? `${filteredDiscover.length} ${filteredDiscover.length === 1 ? 'result' : 'results'}`
              : `${discoverMembers.length} ${discoverMembers.length === 1 ? 'person' : 'people'} in the network`
            }
          </p>

          {filteredDiscover.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDiscover.map(m => (
                <MemberCard key={m.id} member={m} isSelf={false} isConnected={false} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-navy font-medium mb-1">No members found</p>
              <p className="text-body-grey text-sm">Try adjusting your filters</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
