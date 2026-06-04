import { createAdminClient } from '@/lib/supabase/admin'
import { PROFILE_MODES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const MODE_MAP = Object.fromEntries(PROFILE_MODES.map(m => [m.value, m.label]))

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

export default async function OnlineNowPage() {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const { data: members } = await admin
    .from('profiles')
    .select('id, first_name, last_name, username, avatar_url, profile_mode, last_active_at')
    .gte('last_active_at', since)
    .eq('onboarding_completed', true)
    .order('last_active_at', { ascending: false })

  const online = members ?? []

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-display text-3xl font-bold text-navy">Who&apos;s Online Now</h1>
        {online.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-navy bg-lime/20 border border-lime/40 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
            {online.length} active
          </span>
        )}
      </div>

      <p className="text-xs text-body-grey mb-6">
        Active in the last 15 minutes based on <code className="font-mono">last_active_at</code>. Updates on page refresh.
      </p>

      {online.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl px-6 py-12 text-center">
          <p className="text-navy font-medium mb-1">No members currently active.</p>
          <p className="text-sm text-body-grey">Someone will appear here within 15 minutes of visiting the app.</p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {online.map(m => {
            const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Unknown'
            const initials = [m.first_name?.[0], m.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
            const ago = minutesAgo(m.last_active_at!)

            return (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                {/* Avatar */}
                {m.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatar_url}
                    alt={name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-navy/10 text-navy font-semibold flex items-center justify-center shrink-0 text-sm">
                    {initials}
                  </div>
                )}

                {/* Name + mode */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy">{name}</p>
                  {m.profile_mode && (
                    <p className="text-xs text-body-grey">{MODE_MAP[m.profile_mode] ?? m.profile_mode}</p>
                  )}
                </div>

                {/* Active indicator */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-xs text-body-grey">
                    {ago < 1 ? 'Just now' : `${ago}m ago`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
