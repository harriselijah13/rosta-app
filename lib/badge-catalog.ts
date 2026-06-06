export type BadgeDef = {
  slug: string
  label: string
  description: string
  /** Tailwind color class applied when earned */
  color: string
}

export const BADGE_CATALOG: BadgeDef[] = [
  {
    slug: 'founding-member',
    label: 'Founding Member',
    description: 'Joined ROSTA in the founding cohort',
    color: 'text-amber-500',
  },
  {
    slug: 'verified',
    label: 'Verified',
    description: 'Identity verified by the ROSTA team',
    color: 'text-blue-500',
  },
  {
    slug: 'open-door',
    label: 'Open Door',
    description: 'Open Door is currently active on your profile',
    color: 'text-lime-600',
  },
  {
    slug: 'first-connection',
    label: 'Connected',
    description: 'Made your first connection on ROSTA',
    color: 'text-navy',
  },
  {
    slug: 'introducer',
    label: 'Introducer',
    description: 'Facilitated your first warm intro',
    color: 'text-purple-500',
  },
  {
    slug: 'connector',
    label: 'Connector',
    description: 'Reached a connector score of 15',
    color: 'text-indigo-500',
  },
  {
    slug: 'bridge',
    label: 'Bridge',
    description: 'Reached a connector score of 40',
    color: 'text-teal-500',
  },
  {
    slug: 'catalyst',
    label: 'Catalyst',
    description: 'Reached a connector score of 80',
    color: 'text-orange-500',
  },
  {
    slug: 'architect',
    label: 'Architect',
    description: 'Reached a connector score of 150',
    color: 'text-rose-500',
  },
  {
    slug: 'spark',
    label: 'Spark',
    description: 'First connection outcome marked',
    color: 'text-yellow-500',
  },
  {
    slug: 'five-outcomes',
    label: 'Five Outcomes',
    description: '5 connection outcomes marked',
    color: 'text-emerald-500',
  },
  {
    slug: 'table-setter',
    label: 'Table Setter',
    description: 'Matched in an Open Table session',
    color: 'text-cyan-600',
  },
  {
    slug: 'signal-strength',
    label: 'Signal Strength',
    description: 'Kept signals active for 4 consecutive weeks',
    color: 'text-green-500',
  },
  {
    slug: 'thanked',
    label: 'Thanked',
    description: 'Received 3 thank-yous for intros',
    color: 'text-pink-500',
  },
  {
    slug: 'all-in',
    label: 'All In',
    description: 'Earned 5 or more badges',
    color: 'text-navy',
  },
]

export const BADGE_MAP = Object.fromEntries(BADGE_CATALOG.map(b => [b.slug, b]))
