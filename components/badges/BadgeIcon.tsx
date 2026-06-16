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

// Narrow specular highlight at top-right (45°), deep shadow at bottom-left.
// High-contrast stops push the metallic quality at small ring widths.
function metallicRing(ringColor: string): string {
  const highlight = lightenColor(ringColor, 0.70)
  const shadow = darkenColor(ringColor, 0.65)
  return `conic-gradient(from 45deg, ${ringColor} 0deg, ${highlight} 30deg, ${ringColor} 60deg, ${shadow} 180deg, ${ringColor} 300deg, ${highlight} 345deg, ${ringColor} 360deg)`
}

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

    case 'verified':
      // Bold checkmark — clean, immediate
      return <path d="M4.5 12.75l6 6 9-13.5" />

    case 'first-connection':
      // Two overlapping circles — one link formed
      return (
        <>
          <circle cx="8.5" cy="12" r="4.5" />
          <circle cx="15.5" cy="12" r="4.5" />
        </>
      )

    case 'introducer':
      // You (top node) connecting two people below — hierarchical intro pattern
      return (
        <>
          <circle cx="12" cy="4.5" r="2.5" />
          <circle cx="4.5" cy="18.5" r="2.5" />
          <circle cx="19.5" cy="18.5" r="2.5" />
          <path d="M12 7L5 16.5M12 7L19 16.5" />
        </>
      )

    case 'connector':
      // Hub-and-spoke — you're the connection point in a network
      return (
        <>
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 9.5V5M12 14.5V19M9.5 12H5M14.5 12H19" />
        </>
      )

    case 'bridge':
      // Arch bridge — abutments, keystone, arch
      return (
        <path d="M2 19a10 10 0 0120 0M2 19v2M22 19v2M12 9v10" />
      )

    case 'catalyst':
      // Lightning bolt — energy and acceleration
      return (
        <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      )

    case 'architect':
      // Building silhouette with door — master builder
      return (
        <>
          <path d="M3 12L12 4l9 8v9H3v-9z" />
          <path d="M9 21v-5h6v5" />
        </>
      )

    case 'spark':
      // 8-ray starburst + center circle — first result of a connection igniting
      return (
        <>
          <circle cx="12" cy="12" r="2" />
          <path d="M12 10V5M12 14v5M10 12H5M14 12h5M13.41 10.59l2.12-2.12M13.41 13.41l2.12 2.12M10.59 13.41l-2.12 2.12M10.59 10.59l-2.12-2.12" />
        </>
      )

    case 'five-outcomes':
      // Five dots in dice-5 pattern
      return (
        <>
          <circle cx="7" cy="8" r="1.5" />
          <circle cx="17" cy="8" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="7" cy="16" r="1.5" />
          <circle cx="17" cy="16" r="1.5" />
        </>
      )

    case 'table-setter':
      // Simple table: top rail + two legs
      return <path d="M3 9h18M7 9v9M17 9v9" />

    case 'signal-strength':
      // Four ascending bars
      return (
        <>
          <rect x="2" y="17" width="3.5" height="5" rx="1" />
          <rect x="7.5" y="13" width="3.5" height="9" rx="1" />
          <rect x="13" y="8" width="3.5" height="14" rx="1" />
          <rect x="18.5" y="3" width="3.5" height="19" rx="1" />
        </>
      )

    case 'thanked':
      // Heart
      return (
        <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      )

    case 'all-in':
      // 4-pointed star — complete, premium, all-in
      return (
        <path d="M12 2l2.83 7.17L22 12l-7.17 2.83L12 22l-2.83-7.17L2 12l7.17-2.83z" />
      )

    default:
      return <circle cx="12" cy="12" r="2.5" />
  }
}

export default function BadgeIcon({ slug, earned, size = 64 }: Props) {
  const badge = BADGE_MAP[slug]
  const ringColor = badge?.ringColor ?? '#999999'

  const ring = earned
    ? metallicRing(ringColor)
    : 'conic-gradient(from 45deg, #999 0deg, #ccc 30deg, #999 60deg, #555 180deg, #999 300deg, #ccc 345deg, #999 360deg)'

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
