import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AcceptForm from './AcceptForm'

export default async function AcceptIntroPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/intro/accept/${params.id}`)

  const admin = createAdminClient()

  const { data: req } = await admin.from('intro_requests')
    .select('id, requester_id, target_id, facilitator_id, status, facilitator_note, member_a_accepted_at, member_b_accepted_at')
    .eq('id', params.id)
    .single()

  if (!req) notFound()

  const isA = user.id === req.requester_id
  const isB = user.id === req.target_id
  if (!isA && !isB) redirect('/dashboard')

  const otherPartyId = isA ? req.target_id : req.requester_id

  const { data: profiles } = await admin.from('profiles')
    .select('id, first_name, last_name, avatar_url, what_i_do, username')
    .in('id', [req.facilitator_id, otherPartyId])

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const displayName = (id: string) =>
    [byId[id]?.first_name, byId[id]?.last_name].filter(Boolean).join(' ') || 'A member'

  const facilitatorName = displayName(req.facilitator_id)
  const otherProfile = byId[otherPartyId]
  const otherName = displayName(otherPartyId)

  const hasAlreadyResponded = isA ? !!req.member_a_accepted_at : !!req.member_b_accepted_at
  const otherHasResponded = isA ? !!req.member_b_accepted_at : !!req.member_a_accepted_at

  // Already fully resolved
  if (req.status === 'accepted') {
    return (
      <div className="max-w-xl mx-auto px-6 py-10 text-center">
        <div className="w-14 h-14 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-bold text-navy mb-2">You&apos;re connected with {otherName}</h1>
        <p className="text-sm text-body-grey mb-6">Both of you accepted {facilitatorName}&apos;s introduction. Say hello.</p>
        <Link href="/messages" className="inline-flex items-center gap-2 text-sm font-semibold bg-navy text-warm-white px-6 py-2.5 rounded-full hover:bg-navy/90 transition-colors">
          Open messages
        </Link>
      </div>
    )
  }

  if (req.status === 'declined') {
    return (
      <div className="max-w-xl mx-auto px-6 py-10 text-center">
        <p className="text-navy font-medium mb-2">This introduction was declined</p>
        <Link href="/dashboard" className="text-sm text-body-grey hover:text-navy transition-colors">Back to dashboard</Link>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-body-grey hover:text-navy transition-colors mb-8">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </Link>

      <h1 className="font-display text-3xl font-bold text-navy mb-1">
        {facilitatorName} wants to introduce you to {otherName}
      </h1>
      <p className="text-sm text-body-grey mb-6">Do you want to connect?</p>

      {/* Other party card */}
      <div className="flex items-start gap-4 p-5 rounded-2xl border border-border bg-white mb-4">
        {otherProfile?.avatar_url ? (
          <img src={otherProfile.avatar_url} alt={otherName} className="w-14 h-14 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-navy/10 text-navy text-lg font-semibold flex items-center justify-center shrink-0">
            {otherName.trim().split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase() || '?'}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-base font-semibold text-navy">{otherName}</p>
          {otherProfile?.what_i_do && (
            <p className="text-sm text-body-grey mt-0.5">{otherProfile.what_i_do}</p>
          )}
          {otherProfile?.username && (
            <Link href={`/profile/${otherProfile.username}`} className="text-xs text-body-grey hover:text-navy underline mt-1 inline-block transition-colors">
              View profile
            </Link>
          )}
        </div>
      </div>

      {/* Facilitator note */}
      {req.facilitator_note && (
        <div className="bg-surface border border-border rounded-xl px-5 py-4 mb-6">
          <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-1">Why {facilitatorName} thinks you should meet</p>
          <p className="text-sm text-navy leading-relaxed">{req.facilitator_note}</p>
        </div>
      )}

      <AcceptForm
        introId={req.id}
        otherName={otherName}
        hasAlreadyResponded={hasAlreadyResponded}
        otherHasResponded={otherHasResponded}
      />
    </div>
  )
}
