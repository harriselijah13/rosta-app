import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ConnectButton from './ConnectButton'

export default async function QRScanPage({
  params,
}: {
  params: { token: string }
}) {
  const admin = createAdminClient()

  // Resolve token
  const { data: code } = await admin
    .from('invite_codes')
    .select('owner_id, type, expires_at')
    .eq('token', params.token)
    .single()

  if (!code || code.type !== 'member_qr') notFound()
  if (code.expires_at && new Date(code.expires_at) < new Date()) notFound()

  // Fetch owner profile
  const { data: owner } = await admin
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, what_i_do, username, onboarding_completed')
    .eq('id', code.owner_id)
    .single()

  if (!owner || !owner.onboarding_completed) notFound()

  const ownerName = [owner.first_name, owner.last_name].filter(Boolean).join(' ') || 'A member'
  const initials = ownerName.trim().split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()

  // Check viewer auth (non-fatal — show appropriate UI)
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const isSelf = user?.id === owner.id

  // Check already connected (if logged in)
  let isAlreadyConnected = false
  if (user && !isSelf) {
    const [ua, ub] = [user.id, owner.id].sort()
    const { data: conn } = await admin
      .from('connections')
      .select('id').eq('user_a', ua).eq('user_b', ub).maybeSingle()
    isAlreadyConnected = !!conn
  }

  return (
    <div className="min-h-screen bg-warm-white flex flex-col items-center justify-center px-6 py-12">
      {/* Minimal ROSTA header */}
      <div className="absolute top-0 left-0 right-0 px-6 py-4 border-b border-border bg-white">
        <p className="font-display text-xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </p>
      </div>

      <div className="w-full max-w-sm mt-16">
        {/* Owner card */}
        <div className="bg-white border border-border rounded-2xl p-8 mb-4 text-center">
          <div className="mb-5">
            {owner.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={owner.avatar_url}
                alt={ownerName}
                className="w-20 h-20 rounded-full object-cover mx-auto"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-navy/10 text-navy text-xl font-semibold flex items-center justify-center mx-auto">
                {initials || '?'}
              </div>
            )}
          </div>
          <h1 className="font-display text-2xl font-bold text-navy mb-1">{ownerName}</h1>
          {owner.what_i_do && (
            <p className="text-body-grey text-sm mb-3">{owner.what_i_do}</p>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs text-body-grey px-3 py-1 rounded-full bg-surface border border-border">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            ROSTA member
          </span>
        </div>

        {/* Action */}
        {isSelf ? (
          <div className="bg-white border border-border rounded-2xl p-6 text-center">
            <p className="text-sm text-body-grey mb-3">This is your QR code.</p>
            <Link
              href="/qr"
              className="text-sm font-medium text-navy hover:underline"
            >
              View your QR page
            </Link>
          </div>
        ) : isAlreadyConnected ? (
          <div className="bg-white border border-border rounded-2xl p-6 text-center">
            <p className="text-sm text-navy font-medium mb-1">Already connected</p>
            <Link
              href={`/profile/${owner.username ?? owner.id}`}
              className="text-sm text-body-grey hover:text-navy hover:underline"
            >
              View {ownerName}&apos;s profile
            </Link>
          </div>
        ) : !user ? (
          <div className="bg-white border border-border rounded-2xl p-6 text-center">
            <p className="text-sm text-body-grey mb-4">
              Log in to connect with {ownerName}.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm font-medium bg-navy text-warm-white px-6 py-3 rounded-full hover:bg-navy/90 transition-colors"
            >
              Log in to ROSTA
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-2xl p-6">
            <ConnectButton token={params.token} ownerName={ownerName} />
          </div>
        )}
      </div>
    </div>
  )
}
