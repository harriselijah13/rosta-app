import { createAdminClient } from '@/lib/supabase/admin'
import EmailToolsClient, { type SendLog, type ScopeCounts } from './EmailToolsClient'

export const dynamic = 'force-dynamic'

export default async function EmailToolsPage() {
  const admin = createAdminClient()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: allCount },
    { count: foundingCount },
    { count: inactiveCount },
    { data: logRows },
    { data: adminProfiles },
    { data: availableCodeRows },
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true).eq('founding_member', true),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true)
      .or(`last_active_at.is.null,last_active_at.lt.${fourteenDaysAgo}`),
    admin.from('admin_email_logs').select('id, sent_at, scope, subject, recipient_count, recipient_email, sent_by').order('sent_at', { ascending: false }).limit(50),
    admin.from('profiles').select('id, first_name, last_name'),
    admin.from('invite_codes')
      .select('id, token')
      .eq('type', 'founding_invite')
      .is('owner_id', null)
      .is('reserved_for_email', null)
      .is('used_at', null)
      .order('created_at', { ascending: false }),
  ])

  const profileById = Object.fromEntries(
    (adminProfiles ?? []).map(p => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'])
  )

  const counts: ScopeCounts = {
    all:      allCount      ?? 0,
    founding: foundingCount ?? 0,
    inactive: inactiveCount ?? 0,
  }

  const log: SendLog[] = (logRows ?? []).map(r => ({
    id:              r.id,
    sent_at:         r.sent_at,
    scope:           r.scope,
    subject:         r.subject,
    recipient_count: r.recipient_count,
    recipient_email: r.recipient_email,
    sent_by_name:    profileById[r.sent_by] ?? 'Unknown',
  }))

  const availableCodes = (availableCodeRows ?? []).map(c => ({ id: c.id, token: c.token }))

  return <EmailToolsClient counts={counts} log={log} availableCodes={availableCodes} />
}
