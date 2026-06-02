import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import GuestForm from './GuestForm'

export default async function GuestConnectPage({
  params,
}: {
  params: { token: string }
}) {
  const admin = createAdminClient()

  // Resolve token — must be a guest_qr type
  const { data: code } = await admin
    .from('invite_codes')
    .select('id, owner_id, type, expires_at')
    .eq('token', params.token)
    .single()

  if (!code || code.type !== 'guest_qr') notFound()
  if (new Date(code.expires_at) < new Date()) {
    // Expired — show a clean expired screen rather than 404
    return (
      <div className="min-h-screen bg-warm-white flex flex-col items-center justify-center px-6 py-12 text-center">
        <p className="font-display text-xl font-bold text-navy mb-2">
          ROSTA<span className="text-lime">.</span>
        </p>
        <p className="text-body-grey text-sm mt-4">This QR code has expired.</p>
      </div>
    )
  }

  // Fetch host profile
  const { data: host } = await admin
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, what_i_do, building_now, onboarding_completed')
    .eq('id', code.owner_id)
    .single()

  if (!host || !host.onboarding_completed) notFound()

  const hostName = [host.first_name, host.last_name].filter(Boolean).join(' ') || 'A member'
  const initials = hostName.trim().split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="min-h-screen bg-warm-white">
      {/* Minimal header */}
      <div className="bg-white border-b border-border px-6 py-4">
        <p className="font-display text-xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </p>
      </div>

      <div className="max-w-md mx-auto px-6 py-8">
        {/* Host card */}
        <div className="bg-white border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {host.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={host.avatar_url}
                alt={hostName}
                className="w-14 h-14 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-navy/10 text-navy font-semibold flex items-center justify-center shrink-0 text-lg">
                {initials || '?'}
              </div>
            )}
            <div>
              <p className="font-display text-lg font-bold text-navy">{hostName}</p>
              <p className="text-xs text-body-grey">ROSTA member</p>
            </div>
          </div>

          {(host.what_i_do || host.building_now) && (
            <div className="space-y-2 pt-4 border-t border-border">
              {host.what_i_do && (
                <div>
                  <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-0.5">What they do</p>
                  <p className="text-sm text-navy">{host.what_i_do}</p>
                </div>
              )}
              {host.building_now && (
                <div>
                  <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-0.5">Building now</p>
                  <p className="text-sm text-navy">{host.building_now}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-white border border-border rounded-2xl p-6">
          <h1 className="font-display text-xl font-bold text-navy mb-1">
            Stay connected with {host.first_name ?? hostName}
          </h1>
          <p className="text-sm text-body-grey mb-6">
            Leave your details and we&apos;ll send you an email with their profile.
          </p>
          <GuestForm token={params.token} hostName={hostName} />
        </div>

        <p className="text-center text-xs text-body-grey mt-6">
          Powered by{' '}
          <span className="font-medium text-navy">ROSTA</span>
          {' '}— the professional network for founders and operators.
        </p>
      </div>
    </div>
  )
}
