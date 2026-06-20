import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import GuestProfileView from './GuestProfileView'
import MemberConnectView from './MemberConnectView'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function UnifiedQRPage({
  params,
}: {
  params: { handle: string }
}) {
  const { handle } = params
  const admin = createAdminClient()

  // Resolve handle → profile (username or UUID)
  const isUuid = UUID_RE.test(handle)
  const { data: owner } = await admin
    .from('profiles')
    .select('id, username, first_name, last_name, avatar_url, what_i_do, onboarding_completed')
    .eq(isUuid ? 'id' : 'username', handle)
    .single()

  if (!owner || !owner.onboarding_completed) notFound()

  // Fetch working_on signal
  const { data: signal } = await admin
    .from('signals')
    .select('working_on')
    .eq('user_id', owner.id)
    .maybeSingle()

  const ownerName = [owner.first_name, owner.last_name].filter(Boolean).join(' ') || 'A member'
  const ownerInitials = ownerName.trim().split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()

  // Shared profile display props
  const profileProps = {
    handle: owner.username ?? owner.id,
    name: ownerName,
    initials: ownerInitials,
    avatarUrl: owner.avatar_url,
    whatIDo: owner.what_i_do,
    workingOn: signal?.working_on ?? null,
  }

  // Auth check — non-fatal
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Branch 3 / 4: not logged in (or expired session)
  if (!user) {
    return (
      <GuestProfileView {...profileProps} />
    )
  }

  // Branch: scanning own QR
  if (user.id === owner.id) {
    return (
      <div className="min-h-screen bg-warm-white flex flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-xl font-bold text-navy mb-6">
          ROSTA<span className="text-lime">.</span>
        </p>
        <p className="text-body-grey text-sm mb-4">This is your QR code.</p>
        <Link href="/qr" className="text-sm font-medium text-navy hover:underline">
          View your QR page
        </Link>
      </div>
    )
  }

  // Branch 2: already connected → redirect to profile
  const [ua, ub] = [user.id, owner.id].sort()
  const { data: conn } = await admin
    .from('connections')
    .select('id')
    .eq('user_a', ua)
    .eq('user_b', ub)
    .is('removed_at', null)
    .maybeSingle()

  if (conn) {
    redirect(`/profile/${owner.username ?? owner.id}?via=qr`)
  }

  // Branch 1: logged-in member, not yet connected
  return (
    <MemberConnectView
      handle={owner.username ?? owner.id}
      name={ownerName}
      initials={ownerInitials}
      avatarUrl={owner.avatar_url}
      whatIDo={owner.what_i_do}
    />
  )
}
