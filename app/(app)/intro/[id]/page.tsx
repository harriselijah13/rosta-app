import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import RespondForm from './RespondForm'

function timeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3600000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h remaining`
  return `${h}h ${Math.floor((ms % 3600000) / 60000)}m remaining`
}

export default async function IntroRequestPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: req } = await admin.from('intro_requests')
    .select('id, type, requester_id, target_id, facilitator_id, status, requester_note, facilitator_note, expires_at, responded_at, created_at, member_a_accepted_at, member_b_accepted_at')
    .eq('id', params.id).single()

  if (!req) notFound()

  const isOpenDoor = req.type === 'open_door'

  // Access: requester, target, or facilitator
  const partyIds = [req.requester_id, req.target_id, req.facilitator_id].filter(Boolean) as string[]
  if (!partyIds.includes(user.id)) notFound()

  const { data: profiles } = await admin.from('profiles')
    .select('id, first_name, last_name, avatar_url, username, what_i_do')
    .in('id', partyIds)

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const name = (id: string) =>
    [byId[id]?.first_name, byId[id]?.last_name].filter(Boolean).join(' ') || 'A member'
  const profileLink = (id: string) => `/profile/${byId[id]?.username ?? id}`

  const requesterName  = name(req.requester_id)
  const targetName     = name(req.target_id)
  const facilitatorName = req.facilitator_id ? name(req.facilitator_id) : ''

  const isExpired       = new Date(req.expires_at) < new Date()
  const effectiveStatus = isExpired && req.status === 'pending' ? 'expired' : req.status

  // A facilitated intro (created via "Suggest an intro") has facilitator_note set at creation.
  // For pending rows this is a reliable distinguisher; completed intros show a unified status view.
  const isFacilitatedIntro = !isOpenDoor && effectiveStatus === 'pending' && req.facilitator_note !== null

  // Role of the current viewer
  const viewerIsTarget      = user.id === req.target_id
  const viewerIsRequester   = user.id === req.requester_id
  const viewerIsFacilitator = user.id === req.facilitator_id

  // Who can respond (click accept/decline)?
  // - Open door: target
  // - Regular warm_intro (facilitator_note=null at creation): facilitator writes intro note
  // - Facilitated warm_intro: BOTH requester and target respond separately
  const viewerAlreadyResponded = isFacilitatedIntro && (
    (viewerIsRequester && req.member_a_accepted_at !== null) ||
    (viewerIsTarget    && req.member_b_accepted_at !== null)
  )
  const canRespond = effectiveStatus === 'pending' && !viewerAlreadyResponded && (
    isOpenDoor
      ? viewerIsTarget
      : isFacilitatedIntro
        ? (viewerIsRequester || viewerIsTarget)
        : viewerIsFacilitator
  )

  // Responder label for the note section on already-responded rows
  const responderName = isOpenDoor ? targetName : facilitatorName

  const statusBadge: Record<string, { label: string; className: string }> = {
    pending:  { label: 'Awaiting response', className: 'bg-surface text-body-grey border-border' },
    accepted: { label: 'Accepted',          className: 'bg-lime/10 border-lime/40 text-navy'     },
    declined: { label: 'Declined',          className: 'bg-surface text-body-grey border-border' },
    expired:  { label: 'Expired',           className: 'bg-surface text-body-grey border-border' },
  }
  const badge = statusBadge[effectiveStatus] ?? statusBadge.expired

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link
        href="/intro"
        className="inline-flex items-center gap-1.5 text-sm text-body-grey hover:text-navy transition-colors mb-8"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Intros
      </Link>

      {/* Header */}
      <div className="bg-white border border-border rounded-2xl p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            {isOpenDoor ? (
              <>
                <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />Connection request</p>
                <h1 className="font-display text-2xl font-bold text-navy">
                  <Link href={profileLink(req.requester_id)} className="hover:underline">{requesterName}</Link>
                  {' wants to connect'}
                </h1>
                <p className="text-sm text-body-grey mt-1">via Open Door</p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                  {isFacilitatedIntro ? 'Suggested intro' : 'Intro request'}
                </p>
                <h1 className="font-display text-2xl font-bold text-navy">
                  <Link href={profileLink(req.requester_id)} className="hover:underline">{requesterName}</Link>
                  {' → '}
                  <Link href={profileLink(req.target_id)} className="hover:underline">{targetName}</Link>
                </h1>
                <p className="text-sm text-body-grey mt-1">
                  {isFacilitatedIntro
                    ? viewerIsFacilitator
                      ? 'You suggested this intro'
                      : viewerIsRequester
                        ? `${facilitatorName} suggested this intro for you`
                        : `${facilitatorName} suggested you should meet ${requesterName}`
                    : `via ${facilitatorName}`}
                </p>
              </>
            )}
          </div>
          <span className={`text-xs font-medium px-3 py-1 rounded-full border ${badge.className}`}>
            {badge.label}
          </span>
        </div>

        {effectiveStatus === 'pending' && (
          <p className="text-xs text-body-grey">{timeRemaining(req.expires_at)}</p>
        )}

        {/* Requester's note */}
        {req.requester_note && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-2">
              {requesterName}&rsquo;s note
            </p>
            <p className="text-sm text-navy leading-relaxed">{req.requester_note}</p>
          </div>
        )}

        {/* Responder's note (if responded) */}
        {req.facilitator_note && effectiveStatus !== 'pending' && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-2">
              {responderName}&rsquo;s note
            </p>
            <p className="text-sm text-navy leading-relaxed">{req.facilitator_note}</p>
          </div>
        )}
      </div>

      {/* Action panel */}
      {canRespond && (
        <RespondForm
          requestId={req.id}
          requesterName={requesterName}
          targetName={targetName}
          isOpenDoor={isOpenDoor}
          isFacilitated={isFacilitatedIntro}
        />
      )}

      {/* Facilitator status view for pending facilitated intros — no action needed */}
      {isFacilitatedIntro && viewerIsFacilitator && effectiveStatus === 'pending' && (
        <div className="bg-white border border-border rounded-2xl p-6">
          <p className="text-sm font-medium text-navy mb-1">Waiting for both parties to respond</p>
          <p className="text-xs text-body-grey">{timeRemaining(req.expires_at)}</p>
        </div>
      )}

      {/* Already-responded status for facilitated intros */}
      {isFacilitatedIntro && viewerAlreadyResponded && effectiveStatus === 'pending' && (
        <div className="bg-white border border-border rounded-2xl p-6">
          <p className="text-sm font-medium text-navy mb-1">You&apos;ve responded</p>
          <p className="text-xs text-body-grey">Waiting for the other party to respond. {timeRemaining(req.expires_at)}</p>
        </div>
      )}

      {effectiveStatus === 'accepted' && (
        <div className="bg-white border border-border rounded-2xl p-6 text-center">
          <p className="text-sm text-body-grey">
            {requesterName} and {targetName} are now connected.
          </p>
        </div>
      )}

      {effectiveStatus === 'expired' && (
        <div className="bg-surface border border-border rounded-2xl p-6 text-center">
          <p className="text-sm text-body-grey">This request expired before both parties responded.</p>
        </div>
      )}
    </div>
  )
}
