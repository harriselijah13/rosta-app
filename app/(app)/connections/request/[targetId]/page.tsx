import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import OpenDoorForm from './OpenDoorForm'

export default async function OpenDoorRequestPage({
  params,
}: {
  params: { targetId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { targetId } = params
  if (targetId === user.id) redirect('/members')

  const admin = createAdminClient()

  // Target profile + signal in parallel
  const [{ data: target }, { data: signal }] = await Promise.all([
    admin.from('profiles')
      .select('id, first_name, last_name, avatar_url, what_i_do, onboarding_completed')
      .eq('id', targetId).single(),
    admin.from('signals').select('open_to').eq('user_id', targetId).maybeSingle(),
  ])

  if (!target || !target.onboarding_completed) notFound()

  // Must have Open Door on
  if (!signal?.open_to?.includes('open_door')) redirect(`/profile/${targetId}`)

  // Check not already connected
  const [ua, ub] = [user.id, targetId].sort()
  const { data: conn } = await admin.from('connections')
    .select('id').eq('user_a', ua).eq('user_b', ub).maybeSingle()
  if (conn) redirect(`/profile/${targetId}`)

  // Check no pending request
  const { data: pending } = await admin.from('intro_requests')
    .select('id')
    .eq('requester_id', user.id)
    .eq('target_id', targetId)
    .eq('status', 'pending')
    .maybeSingle()

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
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-lime inline-block" />
          <span className="text-xs font-medium text-body-grey uppercase tracking-wide">Open Door</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-navy">
          Connect with {targetName}
        </h1>
        {target.what_i_do && (
          <p className="text-body-grey mt-2">{target.what_i_do}</p>
        )}
      </div>

      {pending ? (
        <div className="bg-white border border-border rounded-2xl p-8 text-center">
          <p className="text-navy font-medium mb-1">You already have a pending request</p>
          <p className="text-sm text-body-grey">{targetName} has up to 48 hours to respond.</p>
        </div>
      ) : (
        <OpenDoorForm targetId={targetId} targetName={targetName} />
      )}
    </div>
  )
}
