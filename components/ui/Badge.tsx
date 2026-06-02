interface BadgeProps {
  children: React.ReactNode
  variant?: 'navy' | 'surface'
}

export default function Badge({ children, variant = 'surface' }: BadgeProps) {
  const variants = {
    navy: 'bg-navy text-warm-white',
    surface: 'bg-surface text-body-grey border border-border',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  )
}
