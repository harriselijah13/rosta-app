import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CheckoutForm from './CheckoutForm'

export const dynamic = 'force-dynamic'

let _stripe: Stripe | null = null
function stripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' as const })
  return _stripe
}

const TIER_LABELS: Record<string, string> = {
  standard:  'Standard',
  founding:  'Founding Member',
  connector: 'Connector',
}

type Currency = 'aed' | 'gbp' | 'usd'

// Resolves the unit_amount for a given currency from a Stripe Price object.
// The primary currency lives on price.unit_amount; additional currencies live in price.currency_options.
function getAmount(price: Stripe.Price, currency: string): number | null {
  if (price.currency === currency) return price.unit_amount ?? null
  const opts = price.currency_options as Record<string, { unit_amount: number | null }> | null | undefined
  return opts?.[currency]?.unit_amount ?? null
}

export default async function VerifyPayPage({
  searchParams,
}: {
  searchParams: { redirect_status?: string; session_id?: string }
}) {
  // Redirect old PaymentIntent return URLs
  if (searchParams.redirect_status) {
    redirect(
      searchParams.redirect_status === 'succeeded'
        ? '/verify/success'
        : '/verify'
    )
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Find an approved, unpaid verification request
  const { data: request } = await admin
    .from('verification_requests')
    .select('id, price_id_used, stripe_payment_status')
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .eq('stripe_payment_status', 'unpaid')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!request) {
    const { data: profile } = await admin
      .from('profiles')
      .select('is_verified, verification_status')
      .eq('id', user.id)
      .single()
    if (profile?.is_verified) redirect('/dashboard')
    redirect('/verify')
  }

  // Look up the tier for this price
  const { data: pricing } = await admin
    .from('verification_pricing')
    .select('tier, stripe_price_id')
    .eq('stripe_price_id', request.price_id_used ?? '')
    .maybeSingle()

  const tier      = pricing?.tier ?? 'standard'
  const priceId   = pricing?.stripe_price_id ?? request.price_id_used ?? ''
  const tierLabel = TIER_LABELS[tier] ?? 'Standard'

  // Fetch the Stripe Price to extract per-currency amounts
  const amounts: Record<Currency, number | null> = { aed: null, gbp: null, usd: null }

  if (priceId) {
    try {
      const price = await stripe().prices.retrieve(priceId)
      amounts.aed = getAmount(price, 'aed')
      amounts.gbp = getAmount(price, 'gbp')
      amounts.usd = getAmount(price, 'usd')
    } catch (err) {
      console.error('[verify/pay] failed to retrieve Stripe price', priceId, err)
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 sm:px-6 py-12">
      <CheckoutForm
        verificationRequestId={request.id}
        tier={tier}
        tierLabel={tierLabel}
        amounts={amounts}
      />
    </main>
  )
}
