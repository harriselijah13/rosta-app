import BadgeIcon from './BadgeIcon'
import type { BadgeDef } from '@/lib/badge-catalog'

type Props = {
  badge: BadgeDef
  earned: boolean
}

function PadlockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3.5 h-3.5"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  )
}

export default function BadgeTile({ badge, earned }: Props) {
  if (earned) {
    return (
      <div
        title={badge.earnDescription}
        className="flex flex-col items-center gap-2 p-3 bg-[#F5F2EE] border border-[#E5E1DB] rounded-2xl"
      >
        {/* Icon bubble */}
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: badge.iconBg }}
        >
          <BadgeIcon
            slug={badge.slug}
            className="w-8 h-8"
            style={{ color: badge.iconColor }}
          />
        </div>
        {/* Text */}
        <div className="flex flex-col items-center gap-0.5 min-w-0 w-full">
          <span className="text-[11px] font-bold text-[#0F1B3C] text-center leading-tight">
            {badge.label}
          </span>
          <span className="text-[9px] text-[#6B7280] text-center leading-snug">
            {badge.earnDescription}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      title={badge.earnDescription}
      className="relative flex flex-col items-center gap-2 p-3 bg-[#F5F2EE] border border-[#E5E1DB] rounded-2xl"
    >
      {/* Icon bubble — greyed */}
      <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#E5E1DB]">
        <BadgeIcon slug={badge.slug} className="w-8 h-8 text-[#9CA3AF] opacity-40" />
      </div>
      {/* Text — greyed */}
      <div className="flex flex-col items-center gap-0.5 min-w-0 w-full opacity-40">
        <span className="text-[11px] font-bold text-[#0F1B3C] text-center leading-tight">
          {badge.label}
        </span>
        <span className="text-[9px] text-[#6B7280] text-center leading-snug">
          {badge.earnDescription}
        </span>
      </div>
      {/* Padlock */}
      <span className="absolute bottom-2 right-2 text-[#9CA3AF] opacity-40">
        <PadlockIcon />
      </span>
    </div>
  )
}
