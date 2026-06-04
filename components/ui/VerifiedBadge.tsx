export default function VerifiedBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
  return (
    <span title="Verified ROSTA member" className="inline-flex shrink-0">
      <svg
        className={cls}
        viewBox="0 0 20 20"
        fill="none"
        aria-label="Verified ROSTA member"
      >
        <circle cx="10" cy="10" r="10" fill="#C8F53C" />
        <path
          d="M6 10.5l2.5 2.5 5.5-5.5"
          stroke="#0F1B3C"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
