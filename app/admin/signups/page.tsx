import { createAdminClient } from '@/lib/supabase/admin'
import SignupsChart from './SignupsChart'

export const dynamic = 'force-dynamic'

export default async function SignupsPage() {
  const admin = createAdminClient()

  const { data: profiles } = await admin
    .from('profiles')
    .select('created_at')
    .eq('onboarding_completed', true)
    .order('created_at', { ascending: true })

  const dates  = (profiles ?? []).map(p => p.created_at as string)
  const total  = dates.length

  return <SignupsChart dates={dates} total={total} />
}
