'use client'

import { useEffect, useRef, useState } from 'react'

function useCountUp(target: number, triggered: boolean): number {
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!triggered || target === 0) {
      if (target === 0) setVal(0)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target)
      return
    }
    const duration = 800
    const start = performance.now()
    let raf: number

    function step(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(eased * target))
      if (t < 1) raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [triggered, target])

  return val
}

type Props = {
  intros: number
  outcomes: number
  signals: number
  tables: number
}

export default function NetworkPulseStats({ intros, outcomes, signals, tables }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [triggered, setTriggered] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTriggered(true); observer.disconnect() } },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const animIntros   = useCountUp(intros,   triggered)
  const animOutcomes = useCountUp(outcomes, triggered)
  const animSignals  = useCountUp(signals,  triggered)
  const animTables   = useCountUp(tables,   triggered)

  const parts = [
    intros   > 0 ? `${animIntros} intro${intros === 1 ? '' : 's'} made this week` : null,
    outcomes > 0 ? `${animOutcomes} collaboration${outcomes === 1 ? '' : 's'} started this month` : null,
    signals  > 0 ? `${animSignals} member${signals === 1 ? '' : 's'} updated their signals this week` : null,
    tables   > 0 ? `${animTables} Open Table${tables === 1 ? '' : 's'} running` : null,
  ].filter((s): s is string => s !== null)

  if (parts.length === 0) return null

  return (
    <div
      ref={ref}
      className="bg-white border border-border rounded-2xl px-5 py-4 shadow-[0_4px_16px_rgba(15,27,60,0.08)] hover:shadow-[0_8px_24px_rgba(15,27,60,0.13)] hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200"
    >
      <p className="text-navy text-xs font-medium tracking-widest uppercase mb-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-lime animate-live-pulse shrink-0" />
        Network pulse
      </p>
      <p className="text-sm font-medium text-navy leading-relaxed">
        {parts.join(' · ')}
      </p>
    </div>
  )
}
