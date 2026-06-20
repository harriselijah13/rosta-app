export type BadgeDef = {
  slug: string
  label: string
  earnDescription: string
  iconColor: string  // hex, used for the icon stroke/fill
  iconBg: string     // hex, used for the icon bubble background
  ringColor: string  // hex, metallic ring tier colour for the dome badge
}

export const BADGE_CATALOG: BadgeDef[] = [
  {
    slug: 'founding-member',
    label: 'Founding Member',
    earnDescription: 'For members who were part of ROSTA from the very beginning.',
    iconColor: '#D97706',
    iconBg: '#FEF3C7',
    ringColor: '#C8F53C',
  },
  {
    slug: 'verified',
    label: 'Verified',
    earnDescription: 'Awarded to members whose identity has been verified by the ROSTA team.',
    iconColor: '#2563EB',
    iconBg: '#DBEAFE',
    ringColor: '#D4A853',
  },
  {
    slug: 'first-connection',
    label: 'First Connection',
    earnDescription: 'For members who\'ve made their first connection on ROSTA. Every network starts somewhere.',
    iconColor: '#0F766E',
    iconBg: '#CCFBF1',
    ringColor: '#4ECDC4',
  },
  {
    slug: 'introducer',
    label: 'Introducer',
    earnDescription: 'Awarded to members who\'ve facilitated their first warm introduction. Generous introductions are what makes the network work.',
    iconColor: '#7C3AED',
    iconBg: '#EDE9FE',
    ringColor: '#4ECDC4',
  },
  {
    slug: 'connector',
    label: 'Connector',
    earnDescription: 'Recognises members who\'ve built an active presence in the network.',
    iconColor: '#4F46E5',
    iconBg: '#E0E7FF',
    ringColor: '#9B8EC4',
  },
  {
    slug: 'bridge',
    label: 'Bridge',
    earnDescription: 'Recognises members who\'ve become a meaningful connector across the network.',
    iconColor: '#0891B2',
    iconBg: '#CFFAFE',
    ringColor: '#4ECDC4',
  },
  {
    slug: 'catalyst',
    label: 'Catalyst',
    earnDescription: 'Recognises members whose activity has genuinely shaped the network around them.',
    iconColor: '#EA580C',
    iconBg: '#FFEDD5',
    ringColor: '#D4A853',
  },
  {
    slug: 'architect',
    label: 'Architect',
    earnDescription: 'Awarded to members who\'ve built deep roots across the network.',
    iconColor: '#E11D48',
    iconBg: '#FFE4E6',
    ringColor: '#C8F53C',
  },
  {
    slug: 'spark',
    label: 'Spark',
    earnDescription: 'For members who\'ve marked their first real-world outcome from a connection made on ROSTA.',
    iconColor: '#CA8A04',
    iconBg: '#FEF9C3',
    ringColor: '#D4A853',
  },
  {
    slug: 'five-outcomes',
    label: 'Five Outcomes',
    earnDescription: 'Awarded to members who\'ve noted 5 outcomes from their connections. Proof the network is working.',
    iconColor: '#059669',
    iconBg: '#D1FAE5',
    ringColor: '#9B8EC4',
  },
  {
    slug: 'table-setter',
    label: 'Table Setter',
    earnDescription: 'For members who\'ve taken part in an Open Table — a small group conversation within the network.',
    iconColor: '#0284C7',
    iconBg: '#E0F2FE',
    ringColor: '#4ECDC4',
  },
  {
    slug: 'signal-strength',
    label: 'Signal Strength',
    earnDescription: 'Recognises members who\'ve kept their signals current for 4 consecutive weeks. Active signals make the network useful for everyone.',
    iconColor: '#16A34A',
    iconBg: '#DCFCE7',
    ringColor: '#9B8EC4',
  },
  {
    slug: 'thanked',
    label: 'Thanked',
    earnDescription: 'Awarded to members who\'ve been thanked 3 times for introductions they made.',
    iconColor: '#DB2777',
    iconBg: '#FCE7F3',
    ringColor: '#9B8EC4',
  },
  {
    slug: 'all-in',
    label: 'All In',
    earnDescription: 'For members who\'ve earned 5 or more badges — a recognition of consistent, generous participation.',
    iconColor: '#0F1B3C',
    iconBg: '#ECFCCB',
    ringColor: '#C8F53C',
  },
]

export const BADGE_MAP = Object.fromEntries(BADGE_CATALOG.map(b => [b.slug, b]))
