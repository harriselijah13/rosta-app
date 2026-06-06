'use client'

import { useEffect, useState } from 'react'

// 4 particles: direction vectors (dx, dy) in px
const PARTICLES = [
  { dx: '0px',   dy: '-14px' },
  { dx: '10px',  dy: '-10px' },
  { dx: '-10px', dy: '-10px' },
  { dx: '5px',   dy: '-16px' },
]

export default function ProgressBar({ percent }: { percent: number }) {
  const [width,  setWidth]  = useState(0)
  const [burst,  setBurst]  = useState(false)

  useEffect(() => {
    // Small delay so CSS transition starts after paint
    const fill = setTimeout(() => setWidth(percent), 80)
    // Burst fires just after fill completes (80ms delay + 800ms transition)
    const boom = setTimeout(() => setBurst(true), 1000)
    return () => { clearTimeout(fill); clearTimeout(boom) }
  }, [percent])

  return (
    <div className="relative h-2 bg-surface rounded-full">
      {/* Fill bar */}
      <div
        className="absolute left-0 top-0 h-full bg-lime rounded-full"
        style={{ width: `${width}%`, transition: 'width 0.8s ease-out' }}
      />

      {/* Glow dot tracking fill end */}
      {width > 2 && (
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-lime animate-live-pulse"
          style={{
            left: `calc(${width}% - 6px)`,
            transition: 'left 0.8s ease-out',
            boxShadow: '0 0 8px rgba(200,245,60,0.9), 0 0 16px rgba(200,245,60,0.4)',
          }}
        />
      )}

      {/* Particle burst when fill completes */}
      {burst && PARTICLES.map((p, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="particle-burst absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-lime pointer-events-none"
          style={{
            left: `calc(${percent}% - 3px)`,
            boxShadow: '0 0 4px rgba(200,245,60,0.8)',
            '--dx': p.dx,
            '--dy': p.dy,
            animationDelay: `${i * 0.04}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
