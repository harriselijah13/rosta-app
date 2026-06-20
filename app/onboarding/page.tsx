import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OnboardingFlow from './OnboardingFlow'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, onboarding_completed')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_completed) redirect('/dashboard')

  const skipStance = searchParams['skip-stance'] === '1'

  return (
    <OnboardingFlow
      userId={user.id}
      initialFirstName={profile?.first_name ?? ''}
      initialLastName={profile?.last_name ?? ''}
      skipStance={skipStance}
    />
  )
}
