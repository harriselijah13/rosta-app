import { redirect } from 'next/navigation'
import Link from 'next/link'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PaymentForm from './PaymentForm'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' as const })

export default async function VerifyPayPage({
  searchParams,
}: {
  searchParams: { redirect_status?: string; payment_intent?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Handle post-payment redirect from Stripe
  if (searchParams.redirect_status === 'succeeded' && searchParams.payment_intent) {
    // Mark the request as paid (webhook will also do this — idempotent)
    await admin
      .from('verification_requests')
      .update({ stripe_payment_status: 'paid' })
      .eq('stripe_payment_intent_id', searchParams.payment_intent)
      .eq('user_id', user.id)

    return (
      <main className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-display text-3xl font-bold text-navy mb-3">Payment successful</h1>
        <p className="text-body-grey text-sm mb-6">
          Your verified badge will appear on your profile shortly. Thank you for supporting the network.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-navy text-warm-white px-8 py-3 rounded-full text-sm font-medium hover:bg-navy/90 transition-colors"
        >
          Back to dashboard
        </Link>
      </main>
    )
  }

  if (searchParams.redirect_status && searchParams.redirect_status !== 'succeeded') {
    return (
      <main className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-navy mb-3">Payment not completed</h1>
        <p className="text-body-grey text-sm mb-6">
          Your payment did not go through. Please try again.
        </p>
        <Link href="/verify/pay" className="inline-block bg-navy text-warm-white px-8 py-3 rounded-full text-sm font-medium hover:bg-navy/90 transition-colors">
          Try again
        </Link>
      </main>
    )
  }

  // Check for an approved, unpaid request
  const { data: request } = await admin
    .from('verification_requests')
    .select('id, price_id_used, stripe_payment_intent_id, stripe_payment_status')
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .eq('stripe_payment_status', 'unpaid')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!request) {
    // No approved unpaid request — check overall state
    const { data: profile } = await admin
      .from('profiles')
      .select('is_verified, verification_status')
      .eq('id', user.id)
      .single()

    if (profile?.is_verified) redirect('/dashboard')
    redirect('/verify')
  }

  // Look up the display price
  const { data: pricing } = await admin
    .from('verification_pricing')
    .select('price_aed, tier')
    .eq('stripe_price_id', request.price_id_used ?? '')
    .maybeSingle()

  const priceAed = pricing?.price_aed ?? 0

  // Create or retrieve the PaymentIntent
  let clientSecret: string

  if (request.stripe_payment_intent_id) {
    // Retrieve existing PI
    const pi = await stripe.paymentIntents.retrieve(request.stripe_payment_intent_id)
    if (pi.status === 'succeeded') {
      // Already paid — webhook may not have fired yet
      await admin.from('profiles').update({ is_verified: true, verification_status: 'approved' }).eq('id', user.id)
      redirect('/dashboard')
    }
    clientSecret = pi.client_secret!
  } else {
    // Create new PaymentIntent
    const pi = await stripe.paymentIntents.create({
      amount:               Math.round(priceAed * 100),
      currency:             'aed',
      metadata:             { verification_request_id: request.id, user_id: user.id },
      description:          'ROSTA Verification',
      statement_descriptor: 'ROSTA',
    })
    clientSecret = pi.client_secret!

    // Store PI ID on the request
    await admin
      .from('verification_requests')
      .update({ stripe_payment_intent_id: pi.id })
      .eq('id', request.id)
  }

  const tierLabels: Record<string, string> = {
    standard:  'Standard',
    founding:  'Founding Member',
    connector: 'Connector',
  }

  return (
    <main className="max-w-md mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-navy mb-2">Complete verification</h1>
        <p className="text-sm text-body-grey">
          Your verification request has been approved. Pay to receive your verified badge.
        </p>
      </div>

      {/* Order summary */}
      <div className="bg-white border border-border rounded-2xl p-5 mb-6">
        <p className="text-xs font-medium text-body-grey uppercase tracking-widest mb-3">Order summary</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-navy">ROSTA Verified</p>
            {pricing?.tier && (
              <p className="text-xs text-body-grey mt-0.5">{tierLabels[pricing.tier] ?? pricing.tier} tier</p>
            )}
          </div>
          <p className="font-display text-2xl font-bold text-navy">
            AED {priceAed.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Payment form */}
      <div className="bg-white border border-border rounded-2xl p-5">
        <p className="text-xs font-medium text-body-grey uppercase tracking-widest mb-4">Payment details</p>
        {priceAed > 0 ? (
          <PaymentForm clientSecret={clientSecret} priceAed={priceAed} />
        ) : (
          <p className="text-sm text-body-grey">
            Pricing not yet configured. Please contact the ROSTA team.
          </p>
        )}
      </div>
    </main>
  )
}
