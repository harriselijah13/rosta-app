import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, verificationPaidEmail } from '@/lib/resend'

export const dynamic = 'force-dynamic'

let _stripe: Stripe | null = null
function stripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' as const })
  return _stripe
}

export async function POST(request: NextRequest) {
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true })
  }

  const pi = event.data.object as Stripe.PaymentIntent
  const admin = createAdminClient()

  // Find the verification request for this payment intent
  const { data: verRequest } = await admin
    .from('verification_requests')
    .select('id, user_id, stripe_payment_status')
    .eq('stripe_payment_intent_id', pi.id)
    .maybeSingle()

  if (!verRequest) {
    // Try metadata fallback
    const requestId = pi.metadata?.verification_request_id
    if (!requestId) {
      console.error('[stripe-webhook] no verification_request found for PI', pi.id)
      return NextResponse.json({ received: true })
    }
    const { data: byId } = await admin
      .from('verification_requests')
      .select('id, user_id, stripe_payment_status')
      .eq('id', requestId)
      .maybeSingle()
    if (!byId) {
      console.error('[stripe-webhook] request not found by metadata id', requestId)
      return NextResponse.json({ received: true })
    }
    Object.assign(verRequest ?? {}, byId)
  }

  // Idempotency — skip if already processed
  if (verRequest?.stripe_payment_status === 'paid') {
    return NextResponse.json({ received: true, skipped: 'already_paid' })
  }

  const userId = verRequest?.user_id ?? pi.metadata?.user_id
  if (!userId) {
    console.error('[stripe-webhook] cannot determine user_id for PI', pi.id)
    return NextResponse.json({ received: true })
  }

  // Mark request as paid
  await admin
    .from('verification_requests')
    .update({ stripe_payment_status: 'paid' })
    .eq('stripe_payment_intent_id', pi.id)

  // Set profile as verified
  await admin
    .from('profiles')
    .update({ is_verified: true, verification_status: 'approved' })
    .eq('id', userId)

  // Send confirmation email
  const [{ data: profile }, authResult] = await Promise.all([
    admin.from('profiles').select('first_name').eq('id', userId).single(),
    admin.auth.admin.getUserById(userId),
  ])

  const email = authResult.data.user?.email
  const name  = profile?.first_name ?? 'there'

  if (email) {
    await sendEmail(email, 'You are now a Verified ROSTA member', verificationPaidEmail(name))
  }

  console.log('[stripe-webhook] verified user', userId, 'via PI', pi.id)
  return NextResponse.json({ received: true })
}
