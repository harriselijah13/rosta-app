export type BadgeDef = {
  slug: string
  label: string
  earnDescription: string
  iconColor: string  // hex, used for the icon stroke/fill
  iconBg: string     // hex, used for the icon bubble background
}

export const BADGE_CATALOG: BadgeDef[] = [
  {
    slug: 'founding-member',
    label: 'Founding Member',
    earnDescription: 'Joined ROSTA as a founding member',
    iconColor: '#D97706',
    iconBg: '#FEF3C7',
  },
  {
    slug: 'verified',
    label: 'Verified',
    earnDescription: 'Identity verified by the ROSTA team',
    iconColor: '#2563EB',
    iconBg: '#DBEAFE',
  },
  {
    slug: 'first-connection',
    label: 'First Connection',
    earnDescription: 'Made your first connection on ROSTA',
    iconColor: '#0F766E',
    iconBg: '#CCFBF1',
  },
  {
    slug: 'introducer',
    label: 'Introducer',
    earnDescription: 'Facilitated your first warm introduction',
    iconColor: '#7C3AED',
    iconBg: '#EDE9FE',
  },
  {
    slug: 'connector',
    label: 'Connector',
    earnDescription: 'Reached a Connector Score of 15',
    iconColor: '#4F46E5',
    iconBg: '#E0E7FF',
  },
  {
    slug: 'bridge',
    label: 'Bridge',
    earnDescription: 'Reached a Connector Score of 40',
    iconColor: '#0891B2',
    iconBg: '#CFFAFE',
  },
  {
    slug: 'catalyst',
    label: 'Catalyst',
    earnDescription: 'Reached a Connector Score of 80',
    iconColor: '#EA580C',
    iconBg: '#FFEDD5',
  },
  {
    slug: 'architect',
    label: 'Architect',
    earnDescription: 'Reached a Connector Score of 150',
    iconColor: '#E11D48',
    iconBg: '#FFE4E6',
  },
  {
    slug: 'spark',
    label: 'Spark',
    earnDescription: 'Marked your first connection outcome',
    iconColor: '#CA8A04',
    iconBg: '#FEF9C3',
  },
  {
    slug: 'five-outcomes',
    label: 'Five Outcomes',
    earnDescription: 'Marked 5 connection outcomes',
    iconColor: '#059669',
    iconBg: '#D1FAE5',
  },
  {
    slug: 'table-setter',
    label: 'Table Setter',
    earnDescription: 'Matched in an Open Table session',
    iconColor: '#0284C7',
    iconBg: '#E0F2FE',
  },
  {
    slug: 'signal-strength',
    label: 'Signal Strength',
    earnDescription: 'Active signals for 4 consecutive weeks',
    iconColor: '#16A34A',
    iconBg: '#DCFCE7',
  },
  {
    slug: 'thanked',
    label: 'Thanked',
    earnDescription: 'Received 3 thank-yous for intro-making',
    iconColor: '#DB2777',
    iconBg: '#FCE7F3',
  },
  {
    slug: 'all-in',
    label: 'All In',
    earnDescription: 'Earned 5 or more ROSTA badges',
    iconColor: '#0F1B3C',
    iconBg: '#ECFCCB',
  },
]

export const BADGE_MAP = Object.fromEntries(BADGE_CATALOG.map(b => [b.slug, b]))
