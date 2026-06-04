import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import VerificationClient, { type VerRequest, type PricingRow } from './VerificationClient'

export const dynamic = 'force-dynamic'

export default async function VerificationPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/dashboard')

  // Fetch all verification requests + pricing tier info
  const { data: rawRequests } = await admin
    .from('verification_requests')
    .select(`
      id, user_id, statement, status, stripe_payment_status, rejection_reason, created_at, price_id_used,
      profiles!inner ( first_name, last_name, username )
    `)
    .order('created_at', { ascending: false })

  const { data: pricing } = await admin
    .from('verification_pricing')
    .select('tier, price_aed, stripe_price_id')
    .order('price_aed', { ascending: true })

  // Resolve emails for each request user
  const seen = new Set<string>()
  const userIds = (rawRequests ?? []).map(r => r.user_id).filter(id => { if (seen.has(id)) return false; seen.add(id); return true })
  const emailMap: Record<string, string> = {}
  await Promise.all(
    userIds.map(async id => {
      const { data } = await admin.auth.admin.getUserById(id)
      if (data.user?.email) emailMap[id] = data.user.email
    })
  )

  // Build a price→tier map
  const priceToTier: Record<string, { tier: string; price_aed: number }> = {}
  for (const p of pricing ?? []) {
    priceToTier[p.stripe_price_id] = { tier: p.tier, price_aed: p.price_aed }
  }

  const requests: VerRequest[] = (rawRequests ?? []).map(r => {
    const p = r.profiles as unknown as { first_name: string | null; last_name: string | null; username: string | null }
    const tierInfo = r.price_id_used ? priceToTier[r.price_id_used] : null
    return {
      id:                   r.id,
      user_id:              r.user_id,
      statement:            r.statement,
      status:               r.status,
      stripe_payment_status: r.stripe_payment_status,
      rejection_reason:     r.rejection_reason,
      created_at:           r.created_at,
      tier:                 tierInfo?.tier ?? null,
      price_aed:            tierInfo?.price_aed ?? null,
      first_name:           p.first_name,
      last_name:            p.last_name,
      username:             p.username,
      email:                emailMap[r.user_id] ?? '—',
    }
  })

  const pricingRows: PricingRow[] = (pricing ?? []).map(p => ({
    tier:      p.tier,
    price_aed: p.price_aed,
  }))

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-navy">Verification</h1>
        {pendingCount > 0 && (
          <p className="text-sm text-amber-700 mt-1">
            {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'} awaiting review.
          </p>
        )}
      </div>

      <VerificationClient requests={requests} pricing={pricingRows} />
    </div>
  )
}
