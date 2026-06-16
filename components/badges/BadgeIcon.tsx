import React from 'react'
import { BADGE_MAP } from '@/lib/badge-catalog'

type Props = {
  slug: string
  earned: boolean
  size?: number
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function toHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map(v =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  )
}

function lightenColor(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex)
  return toHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t)
}

function darkenColor(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex)
  return toHex(r * (1 - t), g * (1 - t), b * (1 - t))
}

function metallicRing(ringColor: string): string {
  const lighter = lightenColor(ringColor, 0.40)
  const darker = darkenColor(ringColor, 0.45)
  return `conic-gradient(from 0deg, ${lighter} 0deg, ${ringColor} 90deg, ${darker} 180deg, ${ringColor} 270deg, ${lighter} 360deg)`
}

// Per-badge icon paths. Only Founding Member is finalised — others are placeholders
// pending approval of the dome+ring treatment.
function IconPath({ slug }: { slug: string }) {
  switch (slug) {
    case 'founding-member':
      return (
        <>
          {/* outer flame */}
          <path d="M12 2C9.5 6.5 7 9.5 7 13.5a5 5 0 0010 0c0-4-2.5-7-5-11.5z" />
          {/* inner flame core */}
          <path d="M12 8.5c-.7 1.5-1.5 3-1.5 4.5a1.5 1.5 0 003 0c0-1.5-.8-3-1.5-4.5z" />
        </>
      )
    default:
      // Placeholder — icon TBD after treatment approval
      return <circle cx="12" cy="12" r="2.5" />
  }
}

export default function BadgeIcon({ slug, earned, size = 64 }: Props) {
  const badge = BADGE_MAP[slug]
  const ringColor = badge?.ringColor ?? '#999999'

  const ring = earned
    ? metallicRing(ringColor)
    : 'conic-gradient(from 0deg, #bbbbbb 0deg, #999999 90deg, #666666 180deg, #999999 270deg, #bbbbbb 360deg)'

  const borderRadius = Math.round((size / 64) * 16)
  const ringWidth = Math.max(2, Math.round((size / 64) * 3))
  const innerSize = size - ringWidth * 2
  const innerRadius = Math.max(1, borderRadius - ringWidth)
  const iconSize = Math.round(innerSize * 0.48)
  const padlockSize = Math.round(size * 0.22)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius,
        background: ring,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: earned ? 1 : 0.45,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Dome body */}
      <div
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerRadius,
          background:
            'radial-gradient(circle at 35% 28%, #1A2F5E 0%, #0F1B3C 50%, #080F1E 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Gloss highlight */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: innerRadius,
            background:
              'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.20) 0%, transparent 55%)',
            pointerEvents: 'none',
          }}
        />
        {/* Icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            width: iconSize,
            height: iconSize,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <IconPath slug={slug} />
        </svg>
      </div>

      {/* Padlock overlay for unearned */}
      {!earned && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            bottom: ringWidth,
            right: ringWidth,
            width: padlockSize,
            height: padlockSize,
            zIndex: 2,
            filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.6))',
          }}
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 018 0v4" />
        </svg>
      )}
    </div>
  )
}
