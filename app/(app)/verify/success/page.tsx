import { redirect } from 'next/navigation'
import Link from 'next/link'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

let _stripe: Stripe | null = null
function stripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' as const })
  return _stripe
}

export default async function VerifySuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sessionId = searchParams.session_id

  if (!sessionId) redirect('/verify')

  let valid = false
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId)
    // Confirm the session belongs to this member and payment went through
    valid =
      session.payment_status === 'paid' &&
      session.metadata?.member_id === user.id
  } catch (err) {
    console.error('[verify/success] failed to retrieve session', sessionId, err)
  }

  if (!valid) {
    return (
      <main className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-navy mb-3">Payment not confirmed</h1>
        <p className="text-sm text-body-grey mb-6">
          We could not confirm your payment. If you have been charged, contact{' '}
          <a href="mailto:hello@onrosta.com" className="text-navy font-medium hover:underline">
            hello@onrosta.com
          </a>
          {' '}and we will sort it out.
        </p>
        <Link
          href="/verify/pay"
          className="inline-block bg-navy text-warm-white px-8 py-3 rounded-full text-sm font-medium hover:bg-navy/90 transition-colors"
        >
          Back to payment
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'rgba(200,245,60,0.15)' }}>
        <svg className="w-7 h-7 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="font-display text-3xl font-bold text-navy mb-3">Payment received.</h1>
      <p className="text-base leading-relaxed mb-8" style={{ color: 'rgba(15,27,60,0.65)' }}>
        Your verification is confirmed. Your verified badge is now live on your profile.
      </p>
      <Link
        href="/dashboard"
        className="text-sm font-medium text-navy hover:underline"
      >
        Back to dashboard
      </Link>
    </main>
  )
}
