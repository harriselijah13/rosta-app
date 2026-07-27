import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import InviteClient from './InviteClient'

export default async function InvitePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: profile }, { count: referralCount }] = await Promise.all([
    supabase
      .from('profiles')
      .select('first_name')
      .eq('id', user.id)
      .single(),
    admin
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', user.id),
  ])

  return (
    <InviteClient
      userId={user.id}
      firstName={profile?.first_name ?? ''}
      referralCount={referralCount ?? 0}
    />
  )
}
