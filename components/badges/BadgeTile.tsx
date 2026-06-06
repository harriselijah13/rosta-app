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
      className="w-3 h-3"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  )
}

export default function BadgeTile({ badge, earned }: Props) {
  if (earned) {
    return (
      <div title={badge.description} className="flex flex-col items-center gap-1.5 p-2">
        <div className="w-12 h-12 rounded-2xl bg-navy border border-[#C8F53C] flex items-center justify-center shadow-sm">
          <BadgeIcon slug={badge.slug} className="w-6 h-6 text-[#C8F53C]" />
        </div>
        <span className="text-[10px] font-bold text-center leading-tight text-navy line-clamp-2">
          {badge.label}
        </span>
      </div>
    )
  }

  return (
    <div title={badge.description} className="flex flex-col items-center gap-1.5 p-2">
      <div className="relative w-12 h-12 rounded-2xl bg-[#F5F2EE] flex items-center justify-center">
        <BadgeIcon slug={badge.slug} className="w-6 h-6 text-gray-400 opacity-25" />
        <span className="absolute bottom-1 right-1 text-gray-400 opacity-40">
          <PadlockIcon />
        </span>
      </div>
      <span className="text-[10px] font-medium text-center leading-tight text-gray-400 opacity-40 line-clamp-2">
        {badge.label}
      </span>
    </div>
  )
}
