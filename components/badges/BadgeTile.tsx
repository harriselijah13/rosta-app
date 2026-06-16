import BadgeIcon from './BadgeIcon'
import type { BadgeDef } from '@/lib/badge-catalog'

type Props = {
  badge: BadgeDef
  earned: boolean
}

export default function BadgeTile({ badge, earned }: Props) {
  return (
    <div
      title={badge.earnDescription}
      className="flex flex-col items-center gap-2 p-3 bg-[#F5F2EE] border border-[#E5E1DB] rounded-2xl"
    >
      <BadgeIcon slug={badge.slug} earned={earned} size={56} />
      <div
        className={`flex flex-col items-center gap-0.5 min-w-0 w-full${earned ? '' : ' opacity-40'}`}
      >
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
