import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureInviteCodes } from '@/lib/invite'
import InviteClient from './InviteClient'

export default async function InvitePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, founding_member')
    .eq('id', user.id)
    .single()

  // Auto-generate codes for founding members
  if (profile?.founding_member) {
    await ensureInviteCodes(user.id)
  }

  const { data: rawCodes } = await admin
    .from('invite_codes')
    .select('id, token, used_by, used_at')
    .eq('owner_id', user.id)
    .eq('type', 'founding_invite')
    .order('created_at')

  const usedByIds = (rawCodes ?? []).map(c => c.used_by).filter(Boolean) as string[]
  const { data: usedByProfiles } = usedByIds.length > 0
    ? await admin.from('profiles').select('id, first_name, last_name').in('id', usedByIds)
    : { data: [] as { id: string; first_name: string | null; last_name: string | null }[] }

  const nameById = Object.fromEntries(
    (usedByProfiles ?? []).map(p => [
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(' ') || 'A member',
    ]),
  )

  const codes = (rawCodes ?? []).map(c => ({
    id:         c.id as string,
    token:      c.token as string,
    used_at:    c.used_at as string | null,
    usedByName: c.used_by ? (nameById[c.used_by as string] ?? null) : null,
  }))

  const availableCount = codes.filter(c => !c.used_at).length
  const redeemedCount  = codes.filter(c => c.used_at).length

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-4xl font-black text-navy mb-2">Invite</h1>
      <p className="text-sm mb-8" style={{ color: 'rgba(15,27,60,0.65)' }}>
        Bring people you trust into your network. Each invite uses one of your codes.
      </p>

      <InviteClient
        codes={codes}
        availableCount={availableCount}
        redeemedCount={redeemedCount}
        memberFirstName={profile?.first_name ?? 'A ROSTA member'}
      />
    </div>
  )
}
