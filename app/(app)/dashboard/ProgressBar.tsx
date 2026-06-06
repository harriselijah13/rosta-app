'use client'

import { useEffect, useState } from 'react'

export default function ProgressBar({ percent }: { percent: number }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setWidth(percent), 80)
    return () => clearTimeout(t)
  }, [percent])

  return (
    <div className="relative h-2 bg-surface rounded-full">
      {/* Fill */}
      <div
        className="absolute left-0 top-0 h-full bg-lime rounded-full"
        style={{ width: `${width}%`, transition: 'width 0.8s ease-out' }}
      />
      {/* Glowing dot at the right edge of the fill */}
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
    </div>
  )
}
