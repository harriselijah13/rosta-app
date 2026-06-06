'use client'

import { useEffect, useState } from 'react'

export default function ScoreCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }
    const duration = 1200
    const start = performance.now()
    let raf: number

    function step(now: number) {
      const t = Math.min((now - start) / duration, 1)
      // cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(eased * value))
      if (t < 1) raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <>{display}</>
}
