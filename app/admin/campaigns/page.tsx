import { createAdminClient } from '@/lib/supabase/admin'
import CampaignsClient, { type Campaign, type Member, type PromoScreen } from './CampaignsClient'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const [
    { data: memberRows   },
    { data: campaignRows },
    { data: deliveryRows },
    { data: screenRows   },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('onboarding_completed', true)
      .order('first_name', { ascending: true }),
    admin
      .from('notification_campaigns')
      .select(
        'id, title, message, status, recipient_mode, recipient_ids, send_mode, ' +
        'recurrence_rule, scheduled_at, recurrence_end, next_send_at, last_sent_at, ' +
        'destination_type, destination_route, promo_screen_id, created_at',
      )
      .order('created_at', { ascending: false }),
    admin.from('campaign_deliveries').select('campaign_id'),
    admin
      .from('temporary_screens')
      .select('id, headline, status, expires_at')
      .order('created_at', { ascending: false }),
  ])

  // Group delivery counts by campaign
  const deliveryCount: Record<string, number> = {}
  for (const row of deliveryRows ?? []) {
    deliveryCount[row.campaign_id] = (deliveryCount[row.campaign_id] ?? 0) + 1
  }

  const members: Member[] = (memberRows ?? []).map((m: Record<string, string>) => ({
    id:         m.id,
    first_name: m.first_name ?? '',
    last_name:  m.last_name  ?? '',
  }))

  const campaigns: Campaign[] = (campaignRows ?? []).map((c: Record<string, unknown>) => ({
    ...(c as Campaign),
    delivery_count: deliveryCount[c.id as string] ?? 0,
  }))

  const promoScreens: PromoScreen[] = (screenRows ?? []).map((s: Record<string, string>) => ({
    id:         s.id,
    headline:   s.headline,
    status:     s.status,
    expires_at: s.expires_at ?? null,
  }))

  return <CampaignsClient members={members} campaigns={campaigns} promoScreens={promoScreens} />
}
