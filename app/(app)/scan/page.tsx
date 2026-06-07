import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ScanClient, { type ScannedCard } from './ScanClient'

export const dynamic = 'force-dynamic'

export default async function ScanPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('scanned_cards')
    .select('id, name, email, company, role, phone, met_at, action_taken, scanned_at')
    .eq('user_id', user.id)
    .order('scanned_at', { ascending: false })

  const cards: ScannedCard[] = (rows ?? []).map(r => ({
    id:           r.id,
    name:         r.name,
    email:        r.email,
    company:      r.company,
    role:         r.role,
    phone:        r.phone,
    met_at:       r.met_at,
    action_taken: r.action_taken as ScannedCard['action_taken'],
    scanned_at:   r.scanned_at,
  }))

  return <ScanClient pastCards={cards} />
}
