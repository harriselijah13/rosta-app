import BadgeIcon from './BadgeIcon'
import type { BadgeDef } from '@/lib/badge-catalog'

type Props = {
  badge: BadgeDef
  earned: boolean
}

export default function BadgeTile({ badge, earned }: Props) {
  return (
    <div
      title={badge.description}
      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-colors ${
        earned ? 'opacity-100' : 'opacity-30 grayscale'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          earned ? 'bg-surface border border-border' : 'bg-surface border border-border'
        }`}
      >
        <BadgeIcon
          slug={badge.slug}
          className={`w-5 h-5 ${earned ? badge.color : 'text-body-grey'}`}
        />
      </div>
      <span className="text-[10px] font-medium text-center leading-tight text-navy line-clamp-2">
        {badge.label}
      </span>
    </div>
  )
}
