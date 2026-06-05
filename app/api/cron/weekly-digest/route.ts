import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend'
import { recordCronRun } from '@/lib/cron-recorder'
import { aiText } from '@/lib/anthropic'

export const dynamic = 'force-dynamic'

type MemberRow = {
  user_id: string
  email: string
  first_name: string | null
  what_i_do: string | null
  building_now: string | null
  who_i_want_to_meet: string | null
  working_on: string | null
  need_right_now: string | null
  connection_names: string[]
  connection_what: string[]
  connection_building: string[]
}

function digestEmailHtml(name: string, body: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:48px 24px;background:#F5F2EE;">
      <p style="font-size:22px;font-weight:700;color:#0F1B3C;margin:0 0 4px;">ROSTA<span style="color:#C8F53C;">.</span></p>
      <hr style="border:none;border-top:1px solid #E5E1DB;margin:20px 0 32px;"/>
      <h1 style="font-size:20px;color:#0F1B3C;margin:0 0 16px;font-weight:700;">Your network this week</h1>
      <p style="color:#6B7280;font-size:15px;line-height:1.7;margin:0 0 28px;white-space:pre-line;">${body}</p>
      <a href="https://app.onrosta.com/members" style="display:inline-block;background:#0F1B3C;color:#ffffff;padding:13px 28px;border-radius:100px;text-decoration:none;font-weight:600;font-size:15px;">Open ROSTA</a>
      <p style="color:#6B7280;font-size:12px;margin-top:32px;line-height:1.5;">You're receiving this because you're a member of ROSTA.</p>
    </div>`
}

async function generateDigest(member: MemberRow): Promise<string | null> {
  const connectionContext = member.connection_names.length === 0
    ? 'They have no connections yet.'
    : member.connection_names.map((name, i) => (
        `- ${name}: ${member.connection_what[i] ?? 'not specified'}${member.connection_building[i] ? `, building: ${member.connection_building[i]}` : ''}`
      )).join('\n')

  const prompt = `You are writing a short, warm weekly network digest email for a professional networking platform called ROSTA.

Member: ${member.first_name ?? 'Member'}
What they do: ${member.what_i_do ?? 'not specified'}
Building now: ${member.building_now ?? 'not specified'}
Who they want to meet: ${member.who_i_want_to_meet ?? 'not specified'}
Working on (signal): ${member.working_on ?? 'not specified'}
Need right now: ${member.need_right_now ?? 'not specified'}

Their connections:
${connectionContext}

Write a personalised 3–4 sentence email body for ${member.first_name ?? 'them'}. The email should:
- Feel warm and human, not automated
- Reference something specific from their profile or signals
- Mention something relevant about 1–2 of their connections if available
- End with a gentle nudge to engage with the network this week
- Never sound like marketing copy
- Be plain text (no markdown, no bullet points)

Output only the email body text — no subject line, no greeting, no sign-off.`

  return aiText(prompt, 250)
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('Authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()

  // Fetch all members with at least one connection
  const { data: connectionRows } = await admin
    .from('connections')
    .select('user_a, user_b')

  if (!connectionRows || connectionRows.length === 0) {
    await recordCronRun('weekly-digest', 'ok', 'no connections found, skipping')
    return NextResponse.json({ sent: 0 })
  }

  // Build a set of user IDs who have at least one connection
  const connectedUsers = new Set<string>()
  const connectionsByUser: Record<string, string[]> = {}
  for (const row of connectionRows) {
    connectedUsers.add(row.user_a)
    connectedUsers.add(row.user_b)
    if (!connectionsByUser[row.user_a]) connectionsByUser[row.user_a] = []
    if (!connectionsByUser[row.user_b]) connectionsByUser[row.user_b] = []
    connectionsByUser[row.user_a].push(row.user_b)
    connectionsByUser[row.user_b].push(row.user_a)
  }

  const userIds = Array.from(connectedUsers)

  // Fetch profiles + signals
  const [{ data: profiles }, { data: signals }] = await Promise.all([
    admin.from('profiles')
      .select('id, first_name, what_i_do, building_now, who_i_want_to_meet')
      .in('id', userIds)
      .eq('onboarding_completed', true),
    admin.from('signals')
      .select('user_id, working_on, need_right_now')
      .in('user_id', userIds),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const signalMap  = Object.fromEntries((signals  ?? []).map(s => [s.user_id, s]))

  // Fetch emails
  const emailMap: Record<string, string> = {}
  await Promise.all(
    userIds.map(async uid => {
      const { data } = await admin.auth.admin.getUserById(uid)
      if (data.user?.email) emailMap[uid] = data.user.email
    })
  )

  let sent = 0
  let skipped = 0

  for (const uid of userIds) {
    const profile = profileMap[uid]
    const email   = emailMap[uid]
    if (!profile || !email) continue

    const connIds = (connectionsByUser[uid] ?? []).slice(0, 5) // cap at 5 connections for context
    const connProfiles = connIds.map(id => profileMap[id]).filter(Boolean)

    const member: MemberRow = {
      user_id:             uid,
      email,
      first_name:          profile.first_name,
      what_i_do:           profile.what_i_do,
      building_now:        profile.building_now,
      who_i_want_to_meet:  profile.who_i_want_to_meet,
      working_on:          signalMap[uid]?.working_on ?? null,
      need_right_now:      signalMap[uid]?.need_right_now ?? null,
      connection_names:    connProfiles.map(p => p.first_name ?? 'A member'),
      connection_what:     connProfiles.map(p => p.what_i_do ?? ''),
      connection_building: connProfiles.map(p => p.building_now ?? ''),
    }

    const body = await generateDigest(member)
    if (!body || body.trim().length < 20) {
      console.error('[weekly-digest] skipping', uid, '— AI returned empty/short body')
      skipped++
      continue
    }

    try {
      await sendEmail(email, 'Your network this week.', digestEmailHtml(profile.first_name ?? 'there', body))
      sent++
    } catch (err) {
      console.error('[weekly-digest] send failed for', uid, err)
      skipped++
    }
  }

  await recordCronRun('weekly-digest', 'ok', `sent ${sent}, skipped ${skipped}`)
  return NextResponse.json({ sent, skipped })
}
