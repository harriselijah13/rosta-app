import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, verificationPaidEmail, verificationPaidAdminEmail } from '@/lib/resend'

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

  // ── checkout.session.completed — primary handler for Checkout Sessions ────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    await handleCheckoutComplete(session)
    return NextResponse.json({ received: true })
  }

  // ── payment_intent.succeeded — legacy handler kept for backwards compat ──
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    // If this PI was created via a Checkout Session, the session webhook
    // already handled everything. Only process standalone PIs.
    if (!pi.metadata?.verification_request_id) {
      return NextResponse.json({ received: true })
    }
    await handlePaymentIntentSucceeded(pi)
    return NextResponse.json({ received: true })
  }

  return NextResponse.json({ received: true })
}

// ── Checkout Session handler ──────────────────────────────────────────────────

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return

  const requestId = session.metadata?.verification_request_id
  const userId    = session.metadata?.member_id

  if (!requestId || !userId) {
    console.error('[stripe-webhook] checkout.session.completed missing metadata', session.id)
    return
  }

  const admin = createAdminClient()

  const { data: verRequest } = await admin
    .from('verification_requests')
    .select('id, user_id, stripe_payment_status')
    .eq('id', requestId)
    .maybeSingle()

  if (!verRequest) {
    console.error('[stripe-webhook] checkout: no verification_request found for', requestId)
    return
  }

  // Idempotency — skip if already processed
  if (verRequest.stripe_payment_status === 'paid') {
    return
  }

  const now = new Date().toISOString()

  // Cast through unknown to handle new columns not yet in the generated Supabase types
  type VerificationUpdate = { stripe_payment_status: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (admin as any)
    .from('verification_requests')
    .update({
      stripe_payment_status:      'paid',
      stripe_checkout_session_id: session.id,
      payment_currency:           session.currency ?? null,
      payment_amount:             session.amount_total != null ? session.amount_total / 100 : null,
      paid_at:                    now,
    } as VerificationUpdate)
    .eq('id', requestId)

  if (updateError) {
    // Payment confirmed in Stripe — continue to verify the profile, but log the drift risk
    console.error('[stripe-webhook] verification_requests update failed', { requestId, error: updateError })
  }

  await admin
    .from('profiles')
    .update({ is_verified: true, verification_status: 'approved' })
    .eq('id', userId)

  const { name: memberName, email: memberEmail } = await sendConfirmationEmail(admin, userId)

  // Admin notification
  try {
    const tier     = session.metadata?.tier ?? 'standard'
    const currency = (session.currency ?? 'aed').toUpperCase()
    const amount   = session.amount_total != null ? session.amount_total / 100 : null

    await sendEmail(
      'harris@onrosta.com',
      `New ROSTA verification: ${memberName}`,
      verificationPaidAdminEmail({
        memberName,
        memberEmail: memberEmail ?? '(unknown)',
        tier,
        currency,
        amount,
        rowUpdateFailed: !!updateError,
      }),
    )
  } catch (adminEmailErr) {
    console.error('[stripe-webhook] admin notification email failed', adminEmailErr)
  }

  console.log('[stripe-webhook] checkout complete — verified user', userId, 'session', session.id)
}

// ── Legacy PaymentIntent handler ──────────────────────────────────────────────

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const requestId = pi.metadata?.verification_request_id
  const userId    = pi.metadata?.user_id ?? pi.metadata?.member_id

  if (!requestId || !userId) {
    console.error('[stripe-webhook] PI succeeded: missing metadata', pi.id)
    return
  }

  const admin = createAdminClient()

  const { data: verRequest } = await admin
    .from('verification_requests')
    .select('id, stripe_payment_status')
    .eq('stripe_payment_intent_id', pi.id)
    .maybeSingle()

  if (!verRequest) {
    const { data: byMetadata } = await admin
      .from('verification_requests')
      .select('id, stripe_payment_status')
      .eq('id', requestId)
      .maybeSingle()
    if (!byMetadata) {
      console.error('[stripe-webhook] PI: no verification_request found for PI', pi.id)
      return
    }
    Object.assign(verRequest ?? {}, byMetadata)
  }

  if (verRequest?.stripe_payment_status === 'paid') return

  await admin
    .from('verification_requests')
    .update({ stripe_payment_status: 'paid' })
    .eq('stripe_payment_intent_id', pi.id)

  await admin
    .from('profiles')
    .update({ is_verified: true, verification_status: 'approved' })
    .eq('id', userId)

  await sendConfirmationEmail(admin, userId)
  console.log('[stripe-webhook] PI succeeded — verified user', userId, 'PI', pi.id)
}

// ── Shared helper ─────────────────────────────────────────────────────────────

async function sendConfirmationEmail(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ name: string; email: string | undefined }> {
  const [{ data: profile }, authResult] = await Promise.all([
    admin.from('profiles').select('first_name').eq('id', userId).single(),
    admin.auth.admin.getUserById(userId),
  ])
  const email = authResult.data.user?.email
  const name  = profile?.first_name ?? 'there'
  if (email) {
    await sendEmail(email, 'You are now a Verified ROSTA member', verificationPaidEmail(name))
  }
  return { name, email }
}
