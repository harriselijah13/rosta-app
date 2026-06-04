'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend'

const BASE = 'https://app.onrosta.com'
const FROM_SUBJECT_PREFIX = '[ROSTA] '

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Forbidden')
  return { admin, userId: user.id }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHtml(subject: string, body: string): string {
  const escaped = escapeHtml(body).replace(/\n/g, '<br/>')
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:48px 24px;background:#F5F2EE;">
      <p style="font-size:22px;font-weight:700;color:#0F1B3C;margin:0 0 4px;">ROSTA<span style="color:#C8F53C;">.</span></p>
      <hr style="border:none;border-top:1px solid #E5E1DB;margin:20px 0 32px;"/>
      <h1 style="font-size:22px;color:#0F1B3C;margin:0 0 16px;font-weight:700;">${escapeHtml(subject)}</h1>
      <p style="color:#6B7280;font-size:15px;line-height:1.7;margin:0 0 28px;">${escaped}</p>
      <a href="${BASE}/dashboard" style="display:inline-block;background:#0F1B3C;color:#ffffff;padding:13px 28px;border-radius:100px;text-decoration:none;font-weight:600;font-size:15px;">Go to ROSTA</a>
      <p style="color:#6B7280;font-size:12px;margin-top:32px;line-height:1.5;">You&apos;re receiving this because you&apos;re a member of ROSTA.</p>
    </div>`
}

async function getEmailList(
  admin: ReturnType<typeof createAdminClient>,
  scope: string,
  specificEmail: string,
): Promise<string[]> {
  if (scope === 'specific') {
    return specificEmail.trim() ? [specificEmail.trim().toLowerCase()] : []
  }

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  let query = admin.from('profiles').select('id').eq('onboarding_completed', true)
  if (scope === 'founding') query = query.eq('founding_member', true)
  if (scope === 'inactive') query = query.or(`last_active_at.is.null,last_active_at.lt.${fourteenDaysAgo}`)

  const { data: profileRows } = await query
  const ids = (profileRows ?? []).map(p => p.id)
  if (!ids.length) return []

  const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const idSet = new Set(ids)
  return users.filter(u => idSet.has(u.id) && u.email).map(u => u.email!)
}

export async function sendAdminEmail(
  scope: string,
  specificEmail: string,
  subject: string,
  body: string,
): Promise<{ sent: number; errors: number }> {
  const { admin, userId } = await requireAdmin()

  const emails = await getEmailList(admin, scope, specificEmail)
  if (!emails.length) return { sent: 0, errors: 0 }

  const html = buildHtml(subject, body)
  const fullSubject = FROM_SUBJECT_PREFIX + subject

  let sent = 0
  let errors = 0

  // Send in batches to avoid blocking too long
  for (const email of emails) {
    try {
      await sendEmail(email, fullSubject, html)
      sent++
    } catch {
      errors++
    }
  }

  // Log the send
  await admin.from('admin_email_logs').insert({
    sent_by:         userId,
    scope,
    subject,
    recipient_count: sent,
    recipient_email: scope === 'specific' ? specificEmail.trim().toLowerCase() : null,
  })

  revalidatePath('/admin/email-tools')
  return { sent, errors }
}

export async function getPreviewHtml(subject: string, body: string): Promise<string> {
  await requireAdmin()
  return buildHtml(subject, body)
}
