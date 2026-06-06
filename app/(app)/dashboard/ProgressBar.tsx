'use client'

import { useEffect, useState } from 'react'

export default function ProgressBar({ percent }: { percent: number }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setWidth(percent), 80)
    return () => clearTimeout(t)
  }, [percent])

  return (
    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
      <div
        className="h-full bg-lime rounded-full"
        style={{ width: `${width}%`, transition: 'width 0.6s ease' }}
      />
    </div>
  )
}
