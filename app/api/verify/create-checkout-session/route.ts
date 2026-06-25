import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

let _stripe: Stripe | null = null
function stripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' as const })
  return _stripe
}

const VALID_TIERS      = ['standard', 'founding', 'connector'] as const
const VALID_CURRENCIES = ['aed', 'gbp', 'usd'] as const
type Currency = typeof VALID_CURRENCIES[number]

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { tier?: string; currency?: string; verification_request_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tier, currency, verification_request_id } = body

  if (!tier || !(VALID_TIERS as readonly string[]).includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }
  if (!currency || !(VALID_CURRENCIES as readonly string[]).includes(currency)) {
    return NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
  }
  if (!verification_request_id) {
    return NextResponse.json({ error: 'Missing verification_request_id' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the caller owns this request and it is approved + unpaid
  const { data: verRequest } = await admin
    .from('verification_requests')
    .select('id, user_id, status, stripe_payment_status')
    .eq('id', verification_request_id)
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .eq('stripe_payment_status', 'unpaid')
    .maybeSingle()

  if (!verRequest) {
    return NextResponse.json({ error: 'Request not found or not eligible for payment' }, { status: 404 })
  }

  // Look up Stripe Price ID for this tier
  const { data: pricing } = await admin
    .from('verification_pricing')
    .select('stripe_price_id')
    .eq('tier', tier)
    .eq('is_active', true)
    .single()

  if (!pricing?.stripe_price_id) {
    return NextResponse.json({ error: 'Pricing not configured for this tier' }, { status: 500 })
  }

  // Get member email for the Checkout Session
  const { data: authUser } = await admin.auth.admin.getUserById(user.id)
  const memberEmail = authUser.user?.email

  const appUrl = 'https://app.onrosta.com'

  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: pricing.stripe_price_id, quantity: 1 }],
    currency: currency as Currency,
    customer_email: memberEmail,
    success_url: `${appUrl}/verify/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/verify/pay`,
    metadata: {
      verification_request_id,
      tier,
      member_id: user.id,
    },
    payment_intent_data: {
      metadata: {
        verification_request_id,
        tier,
        member_id: user.id,
      },
    },
  })

  // Store the checkout session ID so the webhook can correlate back
  // Cast through unknown to handle new column not yet in generated Supabase types
  type VerificationUpdate = { stripe_payment_status: string }
  await admin
    .from('verification_requests')
    .update({ stripe_checkout_session_id: session.id } as unknown as VerificationUpdate)
    .eq('id', verification_request_id)

  return NextResponse.json({ url: session.url })
}
