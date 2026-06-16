'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import { OPEN_TO_OPTIONS, PROFILE_MODES } from '@/lib/constants'
import type { Profile } from '@/lib/types'

const OPEN_TO_MAP = Object.fromEntries(OPEN_TO_OPTIONS.map(o => [o.value, o.label]))
const MODE_MAP    = Object.fromEntries(PROFILE_MODES.map(m => [m.value, m.label]))

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(m: Profile): string {
  const words = [m.first_name, m.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  const a = words[0][0]
  const b = words.length > 1 ? words[words.length - 1][0] : ''
  return (a + b).toUpperCase()
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

const NW_W = 560, NW_H = 420, NW_CX = 280, NW_CY = 210, NW_R = 150
const NW_MAX = 6

const NW_SLOTS = [
  { rotX:  3, rotY:  0, dur: 12, delay: 0.0, tx:  4, ty: -8 },
  { rotX:  2, rotY: -3, dur: 14, delay: 1.5, tx:  7, ty: -6 },
  { rotX: -2, rotY: -3, dur: 11, delay: 3.0, tx:  8, ty:  6 },
  { rotX: -3, rotY:  0, dur: 16, delay: 0.8, tx: -4, ty:  9 },
  { rotX: -2, rotY:  3, dur: 13, delay: 2.2, tx: -7, ty:  7 },
  { rotX:  2, rotY:  3, dur: 10, delay: 1.0, tx: -6, ty: -9 },
] as const

// 14 background ambient dots — warm white on navy backdrop
const NW_BG_DOTS = [
  { cx: '12%', cy: '15%', r: 3,   dur: '5.2s', delay: '0s'   },
  { cx: '85%', cy: '20%', r: 2.5, dur: '6.1s', delay: '1.3s' },
  { cx: '8%',  cy: '70%', r: 3.5, dur: '4.8s', delay: '2.7s' },
  { cx: '90%', cy: '75%', r: 2.5, dur: '5.5s', delay: '0.6s' },
  { cx: '25%', cy: '88%', r: 2,   dur: '7.0s', delay: '3.4s' },
  { cx: '75%', cy: '85%', r: 3,   dur: '5.8s', delay: '1.8s' },
  { cx: '18%', cy: '40%', r: 2,   dur: '6.5s', delay: '4.1s' },
  { cx: '82%', cy: '50%', r: 2.5, dur: '4.4s', delay: '0.9s' },
  { cx: '50%', cy: '8%',  r: 2,   dur: '5.0s', delay: '2.2s' },
  { cx: '45%', cy: '92%', r: 2,   dur: '6.8s', delay: '3.0s' },
  { cx: '60%', cy: '12%', r: 2,   dur: '5.5s', delay: '1.0s' },
  { cx: '35%', cy: '5%',  r: 1.5, dur: '6.3s', delay: '2.0s' },
  { cx: '93%', cy: '42%', r: 2,   dur: '4.7s', delay: '3.8s' },
  { cx: '5%',  cy: '30%', r: 2,   dur: '7.2s', delay: '0.5s' },
]

function NetworkWeb({ current, connections, onBrowse }: {
  current: Profile | undefined
  connections: Profile[]
  onBrowse: () => void
}) {
  const isEmpty    = connections.length === 0
  const visible    = connections.slice(0, NW_MAX)
  const extraCount = connections.length - NW_MAX

  const wrapperRef = useRef<HTMLDivElement>(null)
  const reduced    = useRef(false)
  const [scale,        setScale]        = useState(1)
  const [entered,      setEntered]      = useState(false)
  const [ambientReady, setAmbientReady] = useState(false)
  const [hoveredIdx,   setHoveredIdx]   = useState<number | null>(null)

  // Responsive scaling
  useEffect(() => {
    if (!wrapperRef.current) return
    const ro = new ResizeObserver(([e]) => {
      setScale(Math.min(1, e.contentRect.width / NW_W))
    })
    ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [])

  // Entrance + ambient sequencing
  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced.current) { setEntered(true); setAmbientReady(true); return }
    const el = wrapperRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setEntered(true) },
      { threshold: 0.2 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!entered || reduced.current) return
    const t = setTimeout(() => setAmbientReady(true), 2000)
    return () => clearTimeout(t)
  }, [entered])

  const nodeCount = isEmpty ? NW_MAX : visible.length
  const positions = Array.from({ length: nodeCount }, (_, i) => {
    const a = (i / nodeCount) * 2 * Math.PI - Math.PI / 2
    return { x: NW_CX + NW_R * Math.cos(a), y: NW_CY + NW_R * Math.sin(a) }
  })

  const myIni  = current ? (initials(current) || '?') : '?'
  const avatar = current?.avatar_url ?? null

  return (
    <div
      style={{
        background: 'radial-gradient(ellipse at 50% 45%, #1a2a55 0%, #0F1B3C 65%)',
        borderRadius: '18px',
        padding: 'clamp(28px, 5vw, 40px) clamp(20px, 4vw, 32px)',
        marginBottom: '24px',
      }}
    >
      <div ref={wrapperRef} className="w-full max-w-[560px] mx-auto select-none">
        <div style={{ height: `${NW_H * scale}px`, overflow: 'visible' }}>
          <div style={{ width: `${NW_W}px`, transformOrigin: 'top left', transform: `scale(${scale})` }}>

            <div style={{
              position: 'relative', width: `${NW_W}px`, height: `${NW_H}px`,
              perspective: '800px',
            }}>
              <style>{`
                @media (prefers-reduced-motion: no-preference) {
                  @keyframes nw-c0 { from{transform:translate(0,0)} to{transform:translate(4px,-8px)}  }
                  @keyframes nw-c1 { from{transform:translate(0,0)} to{transform:translate(7px,-6px)}  }
                  @keyframes nw-c2 { from{transform:translate(0,0)} to{transform:translate(8px,6px)}   }
                  @keyframes nw-c3 { from{transform:translate(0,0)} to{transform:translate(-4px,9px)}  }
                  @keyframes nw-c4 { from{transform:translate(0,0)} to{transform:translate(-7px,7px)}  }
                  @keyframes nw-c5 { from{transform:translate(0,0)} to{transform:translate(-6px,-9px)} }
                  @keyframes nw-spoke {
                    0%,100% { opacity:0.55; }
                    50%     { opacity:1;    }
                  }
                  @keyframes nw-ring-pulse {
                    0%,100% { opacity:0.7; }
                    50%     { opacity:1.0; }
                  }
                  @keyframes nw-breathe {
                    0%,100% { transform:scale(1);    }
                    50%     { transform:scale(1.04); }
                  }
                }
              `}</style>

              {/* Background ambient dots — warm white on navy, higher colour value so networkFloat pulse is visible */}
              {NW_BG_DOTS.map((d, i) => (
                <div
                  key={`bg-${i}`}
                  aria-hidden="true"
                  className={ambientReady ? 'absolute rounded-full pointer-events-none network-node' : 'absolute rounded-full pointer-events-none'}
                  style={{
                    left: d.cx, top: d.cy,
                    width: d.r * 2, height: d.r * 2,
                    backgroundColor: 'rgba(245,242,238,0.22)',
                    opacity: ambientReady ? undefined : 0,
                    transition: 'opacity 0.6s ease-out',
                    '--node-duration': d.dur,
                    '--node-delay':    d.delay,
                  } as React.CSSProperties}
                />
              ))}

              {/* SVG overlay — spokes + heartbeat dots */}
              <svg
                aria-hidden="true"
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: `${NW_W}px`, height: `${NW_H}px`,
                  pointerEvents: 'none', overflow: 'visible', zIndex: 0,
                }}
              >
                {positions.map((pos, i) => {
                  const isHovered = hoveredIdx === i
                  const isDimmed  = hoveredIdx !== null && !isHovered
                  const lineDelay = 0.3 + i * 0.08
                  const mx = (NW_CX + pos.x) / 2
                  const my = (NW_CY + pos.y) / 2

                  return (
                    <g key={`spoke-${i}`}>
                      {/* Glow layer — stronger on navy backdrop */}
                      <line
                        x1={NW_CX} y1={NW_CY} x2={pos.x} y2={pos.y}
                        stroke="rgba(200,245,60,0.22)"
                        strokeWidth="8"
                        style={{
                          filter: 'blur(4px)',
                          opacity: entered ? (isDimmed ? 0.2 : 1) : 0,
                          transition: ambientReady
                            ? 'opacity 0.3s ease-out'
                            : `opacity 0.4s ${lineDelay}s ease-out`,
                        }}
                      />
                      {/* Main spoke — dashed lime */}
                      <line
                        x1={NW_CX} y1={NW_CY} x2={pos.x} y2={pos.y}
                        stroke="rgba(200,245,60,0.70)"
                        strokeWidth="1.5"
                        strokeDasharray={isHovered ? undefined : '4 6'}
                        style={{
                          animation: ambientReady
                            ? `nw-spoke ${4 + (i % 3)}s ease-in-out ${(i * 0.65).toFixed(2)}s infinite`
                            : 'none',
                          opacity: entered ? (isDimmed ? 0.3 : 1) : 0,
                          transition: ambientReady
                            ? 'opacity 0.3s ease-out'
                            : `opacity 0.4s ${lineDelay}s ease-out`,
                        }}
                      />
                      {/* Heartbeat dot at midpoint */}
                      {entered && (
                        <circle
                          cx={mx} cy={my}
                          r={2}
                          fill="#C8F53C"
                          style={{
                            animationName: ambientReady ? 'suggestPulse' : 'none',
                            animationDuration: isHovered ? '2s' : '4s',
                            animationTimingFunction: 'ease-in-out',
                            animationIterationCount: 'infinite',
                            animationDelay: `${(i * 0.65).toFixed(2)}s`,
                            opacity: isDimmed ? 0.15 : 1,
                            transition: 'opacity 0.3s ease-out',
                          }}
                        />
                      )}
                    </g>
                  )
                })}
              </svg>

              {/* Ghost cards (empty state) — navy palette, half opacity to read as "future" */}
              {isEmpty && positions.map((pos, i) => {
                const s = NW_SLOTS[i]
                const cardDelay = 0.3 + 5 * 0.08 + 0.5 + i * 0.08
                return (
                  <div
                    key={`ghost-${i}`}
                    style={{
                      position: 'absolute', left: `${pos.x - 50}px`, top: `${pos.y - 27}px`,
                      zIndex: 1,
                      animation: ambientReady
                        ? `nw-c${i} ${s.dur}s ease-in-out ${s.delay}s infinite alternate`
                        : 'none',
                      opacity: entered ? 0.5 : 0,
                      transform: `scale(0.92) rotateX(${s.rotX}deg) rotateY(${s.rotY}deg)`,
                      transition: ambientReady
                        ? 'opacity 0.3s ease-out'
                        : `opacity 0.4s ${cardDelay}s ease-out`,
                    }}
                  >
                    <div style={{
                      width: '100px', height: '54px', borderRadius: '12px',
                      background: '#1e2d5c',
                      border: '1px solid rgba(245,242,238,0.10)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                      display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px',
                    }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(245,242,238,0.10)', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                        <div style={{ width: '44px', height: '7px', borderRadius: '4px', background: 'rgba(245,242,238,0.10)' }} />
                        <div style={{ width: '30px', height: '7px', borderRadius: '4px', background: 'rgba(245,242,238,0.07)' }} />
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Real connection cards — navy palette */}
              {!isEmpty && visible.map((m, i) => {
                const s          = NW_SLOTS[i]
                const pos        = positions[i]
                const ini        = initials(m)
                const isHovered  = hoveredIdx === i
                const isDimmed   = hoveredIdx !== null && !isHovered
                const cardDelay  = 0.3 + 5 * 0.08 + 0.5 + i * 0.08

                return (
                  <div
                    key={m.id}
                    style={{
                      position: 'absolute', left: `${pos.x - 50}px`, top: `${pos.y - 27}px`,
                      zIndex: isHovered ? 3 : 1,
                      animation: ambientReady
                        ? `nw-c${i} ${s.dur}s ease-in-out ${s.delay}s infinite alternate`
                        : 'none',
                      opacity: entered ? (isDimmed ? 0.45 : 1) : 0,
                      transition: ambientReady
                        ? 'opacity 0.3s ease-out'
                        : `opacity 0.4s ${cardDelay}s ease-out`,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <div style={{
                      width: '100px', height: '54px', borderRadius: '12px',
                      background: '#1e2d5c',
                      border: `1px solid ${isHovered ? 'rgba(245,242,238,0.30)' : 'rgba(245,242,238,0.12)'}`,
                      boxShadow: isHovered
                        ? '0 12px 32px rgba(0,0,0,0.40)'
                        : '0 4px 20px rgba(0,0,0,0.30)',
                      display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px',
                      transform: `scale(0.92) rotateX(${s.rotX}deg) rotateY(${s.rotY}deg) translateY(${isHovered ? -6 : 0}px)`,
                      transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out, border-color 0.2s ease-out',
                    }}>
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatar_url} alt={ini}
                          style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%',
                          background: 'rgba(245,242,238,0.15)', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#F5F2EE', fontSize: '11px', fontWeight: 600, lineHeight: 1,
                        }}>{ini}</div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#F5F2EE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.first_name ?? ini}
                        </div>
                        {m.what_i_do && (
                          <div style={{ fontSize: '9px', color: 'rgba(245,242,238,0.60)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.what_i_do}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Lime ring — pulse + slow rotation */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute', left: `${NW_CX - 44}px`, top: `${NW_CY - 44}px`,
                  width: '88px', height: '88px', borderRadius: '50%',
                  border: '2px solid rgba(200,245,60,0.75)',
                  pointerEvents: 'none', zIndex: 2,
                  opacity: entered ? 1 : 0,
                  transition: 'opacity 0.6s ease-out 0.2s',
                  animation: ambientReady
                    ? 'nw-ring-pulse 5s ease-in-out infinite, orbitDot 40s linear infinite'
                    : 'none',
                }}
              />

              {/* Orbital dot rotating on the outside of the lime ring (~25s) */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: `${NW_CX - 50}px`, top: `${NW_CY - 50}px`,
                  width: '100px', height: '100px',
                  pointerEvents: 'none', zIndex: 3,
                  opacity: ambientReady ? 1 : 0,
                  transition: 'opacity 0.8s ease-out 1s',
                  animationName: ambientReady ? 'orbitDot' : 'none',
                  animationDuration: '25s',
                  animationTimingFunction: 'linear',
                  animationIterationCount: 'infinite',
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 6, height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(200,245,60,0.60)',
                }} />
              </div>

              {/* Centre node — warm white outer glow on navy backdrop */}
              <div style={{
                position: 'absolute', left: `${NW_CX - 36}px`, top: `${NW_CY - 36}px`,
                width: '72px', height: '72px', borderRadius: '50%',
                border: '2px solid rgba(200,245,60,0.40)',
                boxShadow: '0 0 32px 8px rgba(200,245,60,0.10), 0 0 50px 16px rgba(245,242,238,0.07), 0 8px 24px rgba(0,0,0,0.30)',
                overflow: 'hidden', zIndex: 4, background: '#0F1B3C',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: entered ? 1 : 0,
                transform: entered ? 'scale(1)' : 'scale(0.96)',
                transition: 'opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.16,1,0.3,1)',
                animation: ambientReady ? 'nw-breathe 4s ease-in-out infinite' : 'none',
              }}>
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt={myIni}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <span style={{
                    color: '#C8F53C', fontSize: '18px', fontWeight: 700,
                    fontFamily: 'var(--font-fraunces), Georgia, serif',
                    lineHeight: 1, userSelect: 'none',
                  }}>
                    {myIni}
                  </span>
                )}
              </div>

              {!isEmpty && extraCount > 0 && (
                <div style={{ position: 'absolute', bottom: '12px', right: '16px', fontSize: '11px', color: 'rgba(245,242,238,0.50)' }}>
                  +{extraCount} more
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isEmpty && (
        <div className="text-center" style={{ marginTop: '8px', paddingBottom: '4px' }}>
          <p className="font-display font-bold text-xl mb-2" style={{ color: 'var(--warm-white)' }}>Your network starts here.</p>
          <button
            onClick={onBrowse}
            className="text-sm transition-colors hover:underline decoration-lime"
            style={{ color: 'rgba(245,242,238,0.65)' }}
          >
            Find people worth knowing.
          </button>
          <p style={{
            marginTop: '16px',
            fontFamily: 'var(--font-fraunces), Georgia, serif',
            fontStyle: 'italic',
            fontSize: '14px',
            color: 'rgba(245,242,238,0.42)',
            fontWeight: 400,
          }}>
            Your network grows as you connect.
          </p>
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

// ── Filter pill rows ───────────────────────────────────────────────────────────

const FILTER_MODES   = [{ value: '', label: 'All modes' },   ...PROFILE_MODES.map(m => ({ value: m.value, label: m.label }))]
const FILTER_OPEN_TO = [{ value: '', label: 'Any signal' }, ...OPEN_TO_OPTIONS]

// ── Main export ────────────────────────────────────────────────────────────────

export default function MemberDirectory({
  members,
  currentUserId,
  currentUserProfile,
  connectedUserIds,
}: {
  members: Profile[]
  currentUserId: string
  currentUserProfile: Profile | null
  connectedUserIds: string[]
}) {
  const [tab,            setTab]      = useState<'network' | 'members'>('network')
  const [search,         setSearch]   = useState('')
  const [locationFilter, setLocation] = useState('')
  const [modeFilter,     setMode]     = useState('')
  const [openToFilter,   setOpenTo]   = useState('')

  const connectedSet = useMemo(() => new Set(connectedUserIds), [connectedUserIds])

  const connectedMembers = useMemo(() => members.filter(m => connectedSet.has(m.id)), [members, connectedSet])
  const discoverMembers  = useMemo(
    () => members.filter(m => m.id !== currentUserId && !connectedSet.has(m.id)),
    [members, currentUserId, connectedSet],
  )
  const suggestions = useMemo(
    () => computeSuggestions(currentUserProfile ?? undefined, discoverMembers, 4),
    [currentUserProfile, discoverMembers],
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
      <div className="mb-6">
        <h1 className="font-display text-4xl font-bold text-navy">Members</h1>
      </div>

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
            current={currentUserProfile ?? undefined}
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
