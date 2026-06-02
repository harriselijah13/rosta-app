import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="w-full max-w-md text-center">
      <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-7 h-7 text-navy"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="font-display text-3xl font-bold text-navy mb-3">
          Check your email
        </h1>
        <p className="text-body-grey mb-8">
          We sent a verification link to your inbox. Click it to activate your
          account and get started.
        </p>
        <p className="text-sm text-body-grey">
          Didn&apos;t receive it?{' '}
          <Link href="/signup" className="text-navy font-medium hover:underline">
            Try again
          </Link>
        </p>
      </div>
    </div>
  )
}
