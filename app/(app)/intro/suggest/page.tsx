import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SuggestForm from './SuggestForm'

export default async function SuggestIntroPage({
  searchParams,
}: {
  searchParams: { memberA?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: connRows } = await admin
    .from('connections')
    .select('user_a, user_b')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

  const connectionIds = (connRows ?? []).map(c =>
    c.user_a === user.id ? c.user_b : c.user_a
  )
  const prefilledId = searchParams.memberA ?? null

  const backLink = (
    <Link
      href="/intro"
      className="inline-flex items-center gap-1.5 text-sm text-body-grey hover:text-navy transition-colors mb-8"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Intros
    </Link>
  )

  if (connectionIds.length < 2) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        {backLink}
        <div className="bg-white border border-border rounded-2xl p-8 text-center">
          <p className="text-navy font-medium mb-2">Not enough connections yet</p>
          <p className="text-sm text-body-grey">
            You need at least two connections to suggest an intro.
          </p>
        </div>
      </div>
    )
  }

  const [{ data: profiles }, { data: edgeRows }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, what_i_do')
      .in('id', connectionIds)
      .eq('onboarding_completed', true),
    admin
      .from('connections')
      .select('user_a, user_b')
      .in('user_a', connectionIds)
      .in('user_b', connectionIds),
  ])

  const connections = (profiles ?? [])
    .map(p => ({
      id: p.id as string,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'A member',
      avatarUrl: (p.avatar_url as string | null) ?? null,
      whatIDo: (p.what_i_do as string | null) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const initialMemberA = prefilledId
    ? (connections.find(c => c.id === prefilledId) ?? null)
    : null

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {backLink}

      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-navy">Suggest an intro</h1>
        <p className="text-sm text-body-grey mt-2">Know two people who should meet? Put them in touch.</p>
      </div>

      <SuggestForm
        connections={connections}
        edges={(edgeRows ?? []) as { user_a: string; user_b: string }[]}
        initialMemberA={initialMemberA}
      />
    </div>
  )
}
