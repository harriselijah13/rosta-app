import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import IntroRequestForm from './IntroRequestForm'

export default async function IntroRequestPage({
  params,
}: {
  params: { targetId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { targetId } = params

  if (targetId === user.id) redirect('/members')

  // Fetch target profile
  const { data: target } = await admin.from('profiles')
    .select('id, first_name, last_name, avatar_url, what_i_do, onboarding_completed')
    .eq('id', targetId).single()
  if (!target || !target.onboarding_completed) notFound()

  // Check not already connected
  const [acA, acB] = [user.id, targetId].sort()
  const { data: existingConn } = await admin.from('connections')
    .select('id').eq('user_a', acA).eq('user_b', acB).maybeSingle()
  if (existingConn) redirect(`/profile/${targetId}`)

  // Check no existing pending request
  const { data: existingReq } = await admin.from('intro_requests')
    .select('id').eq('requester_id', user.id).eq('target_id', targetId).eq('status', 'pending').maybeSingle()

  // Mutual connections: connected to both viewer and target
  const [{ data: viewerConns }, { data: targetConns }] = await Promise.all([
    admin.from('connections').select('user_a, user_b').or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
    admin.from('connections').select('user_a, user_b').or(`user_a.eq.${targetId},user_b.eq.${targetId}`),
  ])

  const viewerIds = new Set(
    (viewerConns ?? []).map(c => c.user_a === user.id ? c.user_b : c.user_a)
  )
  const targetIds = new Set(
    (targetConns ?? []).map(c => c.user_a === targetId ? c.user_b : c.user_a)
  )
  const mutualIds = Array.from(viewerIds).filter(id => targetIds.has(id))

  if (mutualIds.length === 0) redirect(`/profile/${targetId}`)

  // Fetch mutual profiles
  const { data: mutualProfiles } = await admin.from('profiles')
    .select('id, first_name, last_name, avatar_url, what_i_do')
    .in('id', mutualIds)

  // Credit balance (lazy reset)
  const period = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })()
  const { data: credits } = await supabase.from('intro_credits')
    .select('balance, period').eq('user_id', user.id).maybeSingle()
  const creditBalance = (!credits || credits.period !== period) ? 3 : credits.balance

  const targetName = [target.first_name, target.last_name].filter(Boolean).join(' ') || 'this member'

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link
        href={`/profile/${targetId}`}
        className="inline-flex items-center gap-1.5 text-sm text-body-grey hover:text-navy transition-colors mb-8"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {targetName}
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-navy">
          Request an intro to {targetName}
        </h1>
        {target.what_i_do && (
          <p className="text-body-grey mt-2">{target.what_i_do}</p>
        )}
      </div>

      {existingReq ? (
        <div className="bg-white border border-border rounded-2xl p-8 text-center">
          <p className="text-navy font-medium mb-1">You already have a pending intro request</p>
          <p className="text-sm text-body-grey">Your facilitator has up to 48 hours to respond.</p>
        </div>
      ) : creditBalance < 1 ? (
        <div className="bg-white border border-border rounded-2xl p-8 text-center">
          <p className="text-navy font-medium mb-1">No intro credits remaining</p>
          <p className="text-sm text-body-grey">You&apos;ll get 3 more on the 1st of next month. Earn credits back by facilitating intros for others.</p>
        </div>
      ) : (
        <IntroRequestForm
          requesterId={user.id}
          targetId={targetId}
          targetName={targetName}
          mutuals={mutualProfiles ?? []}
          credits={creditBalance}
        />
      )}
    </div>
  )
}
