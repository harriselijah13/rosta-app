'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const BG_DOTS = [
  { top: '14%', left: '6%',   size: 4, dur: '5.2s', delay: '0s'   },
  { top: '72%', left: '10%',  size: 3, dur: '4.6s', delay: '1.4s' },
  { top: '45%', left: '4%',   size: 3, dur: '6.8s', delay: '3.1s' },
  { top: '20%', right: '8%',  size: 5, dur: '6.1s', delay: '0.8s' },
  { top: '68%', right: '6%',  size: 3, dur: '5.5s', delay: '2.1s' },
  { top: '38%', right: '5%',  size: 4, dur: '4.9s', delay: '1.7s' },
  { top: '85%', left: '45%',  size: 3, dur: '7.2s', delay: '2.5s' },
  { top: '8%',  left: '58%',  size: 2, dur: '5.8s', delay: '0.4s' },
]

// Asymmetric triangular constellation — not centred, slightly off-balance
const CONSTELLATION = [
  { left: '33%', top: '28%', size: 2.5 },
  { left: '65%', top: '40%', size: 3   },
  { left: '46%', top: '66%', size: 2.5 },
]

function AvatarCircle({
  size,
  hoverClass,
  orbitPhase,
  orbitActive,
}: {
  size: number
  hoverClass: string
  orbitPhase: number
  orbitActive: boolean
}) {
  return (
    <div
      className={`relative rounded-full border border-white/15 shrink-0
        transition-transform duration-500 ease-out ${hoverClass}`}
      style={{
        width: size,
        height: size,
        backgroundColor: 'rgba(245,242,238,0.10)',
        boxShadow: '0 0 30px 4px rgba(245,242,238,0.05)',
      }}
      aria-hidden="true"
    >
      {/* Inner ring at 60% diameter */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: Math.round(size * 0.6),
          height: Math.round(size * 0.6),
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          border: '1px solid rgba(245,242,238,0.22)',
        }}
      />
      {/* Constellation dots */}
      {CONSTELLATION.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            backgroundColor: 'rgba(245,242,238,0.60)',
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      {/* Orbital dot — wrapper rotates around avatar centre; dot anchored at top of orbit */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          animationName: 'orbitDot',
          animationDuration: '25s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
          animationDelay: `${-orbitPhase}s`,
          animationPlayState: orbitActive ? 'running' : 'paused',
        }}
      >
        <div
          className="absolute rounded-full"
          style={{
            top: -7,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 2,
            height: 2,
            backgroundColor: 'rgba(245,242,238,0.60)',
          }}
        />
      </div>
    </div>
  )
}

function PulseDot({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div
      className="suggest-pulse absolute rounded-full pointer-events-none"
      style={{
        width: 3,
        height: 3,
        backgroundColor: 'var(--lime)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    />
  )
}

export default function SuggestIntroBlock() {
  const wrapRef  = useRef<HTMLDivElement>(null)
  const reduced  = useRef(false)
  const [entered,     setEntered]     = useState(false)
  const [orbitActive, setOrbitActive] = useState(false)
  const [pulseActive, setPulseActive] = useState(false)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced.current) { setEntered(true); return }
    const el = wrapRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setEntered(true) },
      { threshold: 0.25 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!entered || reduced.current) return
    const t1 = setTimeout(() => setOrbitActive(true), 1400)
    const t2 = setTimeout(() => setPulseActive(true), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [entered])

  const lineTransition = entered
    ? 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s'
    : 'none'

  const lineStyle = {
    backgroundColor: 'var(--lime)',
    boxShadow: '0 0 6px 0 rgba(200,245,60,0.30)',
    transition: lineTransition,
  }

  return (
    <div ref={wrapRef} className="card-enter" style={{ animationDelay: '0.15s' }}>
      <Link
        href="/intro/suggest"
        className="suggest-block block relative overflow-hidden rounded-[20px] outline-none
          focus-visible:ring-2 focus-visible:ring-lime
          focus-visible:ring-offset-2 focus-visible:ring-offset-warm-white
          group"
        style={{
          background: 'radial-gradient(ellipse at 50% 45%, #1a2a55 0%, var(--navy) 65%)',
          padding: 'clamp(28px, 5vw, 40px) clamp(24px, 5vw, 32px)',
          transform: entered ? 'scale(1)' : 'scale(0.97)',
          transition: entered ? 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        }}
        aria-label="Suggest an intro"
      >
        {/* Ambient background dots */}
        {BG_DOTS.map((d, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="absolute rounded-full pointer-events-none network-node"
            style={{
              top:   d.top,
              left:  'left'  in d ? (d as { left: string }).left   : undefined,
              right: 'right' in d ? (d as { right: string }).right : undefined,
              width: d.size,
              height: d.size,
              backgroundColor: 'rgba(245,242,238,0.06)',
              '--node-duration': d.dur,
              '--node-delay':    d.delay,
            } as React.CSSProperties}
          />
        ))}

        <div className="relative max-w-[480px] mx-auto">

          {/* ── Desktop: horizontal avatars + line (sm+) ── */}
          <div className="hidden sm:flex items-center justify-center mb-8">
            <AvatarCircle
              size={68} hoverClass="group-hover:translate-x-1.5"
              orbitPhase={0} orbitActive={orbitActive}
            />
            <div className="relative mx-5 h-[1.5px] flex-1 max-w-[80px]" aria-hidden="true">
              <div
                className="absolute inset-0 origin-center"
                style={{
                  ...lineStyle,
                  transform: entered ? 'scaleX(1)' : 'scaleX(0)',
                }}
              />
              <PulseDot active={pulseActive} />
            </div>
            <AvatarCircle
              size={68} hoverClass="group-hover:-translate-x-1.5"
              orbitPhase={10} orbitActive={orbitActive}
            />
          </div>

          {/* ── Mobile: vertical avatars + line (<sm) ── */}
          <div className="flex sm:hidden flex-col items-center mb-8">
            <AvatarCircle
              size={60} hoverClass="group-hover:translate-y-1.5"
              orbitPhase={0} orbitActive={orbitActive}
            />
            <div className="relative my-4 w-[1.5px] h-10" aria-hidden="true">
              <div
                className="absolute inset-0 origin-center"
                style={{
                  ...lineStyle,
                  transform: entered ? 'scaleY(1)' : 'scaleY(0)',
                }}
              />
              <PulseDot active={pulseActive} />
            </div>
            <AvatarCircle
              size={60} hoverClass="group-hover:-translate-y-1.5"
              orbitPhase={10} orbitActive={orbitActive}
            />
          </div>

          <h2
            className="font-display text-center font-black leading-[1.1] mb-3"
            style={{ color: 'var(--warm-white)', fontSize: 'clamp(22px, 4.5vw, 30px)' }}
          >
            Know two people who should meet?
          </h2>
          <p
            className="text-center text-[15px] leading-relaxed mb-8"
            style={{ color: 'rgba(245,242,238,0.70)' }}
          >
            Introduce them. It&apos;s how the network gets stronger.
          </p>
          <div className="flex justify-center">
            <span
              className="inline-flex items-center rounded-full text-sm font-semibold
                transition-transform duration-200 ease-out group-hover:-translate-y-0.5"
              style={{
                backgroundColor: 'var(--lime)',
                color: 'var(--navy)',
                padding: '14px 28px',
              }}
            >
              Suggest an intro
            </span>
          </div>

        </div>
      </Link>
    </div>
  )
}
