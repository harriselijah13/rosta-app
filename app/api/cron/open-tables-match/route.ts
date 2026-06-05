import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, openTableStartedEmail, openTableFallbackEmail } from '@/lib/resend'
import { recordCronRun } from '@/lib/cron-recorder'
import { aiText } from '@/lib/anthropic'

export const dynamic = 'force-dynamic'

function currentMonthPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Keyword fallback ─────────────────────────────────────────────────────────

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'are', 'this', 'have', 'from', 'they', 'will', 'been', 'has', 'but', 'not', 'can', 'who', 'all', 'our', 'its', 'you', 'your'])
function tokens(text: string | null): Set<string> {
  if (!text) return new Set()
  return new Set(text.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 3 && !STOP.has(w)))
}
function overlap(a: Set<string>, b: Set<string>): number {
  return Array.from(a).filter(t => b.has(t)).length
}
function complementScore(aWhoIWantToMeet: string | null, bWhatIDo: string | null, bBuildingNow: string | null): number {
  const want  = tokens(aWhoIWantToMeet)
  const offer = new Set(Array.from(tokens(bWhatIDo)).concat(Array.from(tokens(bBuildingNow))))
  return overlap(want, offer)
}
function pairScoreKeyword(a: Member, b: Member): number {
  return complementScore(a.who_i_want_to_meet, b.what_i_do, b.building_now)
       + complementScore(b.who_i_want_to_meet, a.what_i_do, a.building_now)
}

// ── AI matching ──────────────────────────────────────────────────────────────

type AIGroupResult = { groups: number[][] } | null

async function aiFormGroups(members: Member[]): Promise<AIGroupResult> {
  const profiles = members.map((m, i) => (
    `[${i}] ${m.first_name ?? 'Member'}
  - What they do: ${m.what_i_do ?? 'not specified'}
  - Building: ${m.building_now ?? 'not specified'}
  - Who they want to meet: ${m.who_i_want_to_meet ?? 'not specified'}`
  )).join('\n\n')

  const targetSize = Math.round(members.length / Math.max(1, Math.round(members.length / 5)))

  const prompt = `You are forming small groups of professionals for a monthly networking event called Open Table. Groups should have ${Math.min(4, members.length)}–6 members each with complementary skills and aligned interests — meaning member A wants to meet someone like member B, and vice versa. Prioritise semantic compatibility, not just keyword overlap.

Here are the ${members.length} opted-in members (indexed 0–${members.length - 1}):

${profiles}

Return ONLY a JSON object with a "groups" key containing an array of arrays of member indices. Every member must appear in exactly one group. Groups must have at least 4 members (merge small remainders into existing groups). Example format: {"groups":[[0,1,2,3],[4,5,6,7,8]]}

Return only valid JSON — no explanation, no markdown.`

  const raw = await aiText(prompt, 600)
  if (!raw) return null

  try {
    // Extract JSON from the response
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed.groups)) return null

    // Validate: all indices in range, every member present exactly once
    const seen = new Set<number>()
    for (const group of parsed.groups) {
      if (!Array.isArray(group)) return null
      for (const idx of group) {
        if (typeof idx !== 'number' || idx < 0 || idx >= members.length) return null
        if (seen.has(idx)) return null
        seen.add(idx)
      }
    }
    if (seen.size !== members.length) return null

    return { groups: parsed.groups }
  } catch {
    return null
  }
}

// ── Keyword greedy grouping (fallback) ───────────────────────────────────────

function formGroupsKeyword(members: Member[]): Member[][] {
  if (members.length < 4) return []
  const n = members.length
  const targetGroupCount = Math.round(n / 5) || 1
  const shuffled = [...members].sort(() => Math.random() - 0.5)
  if (n <= 6) return [shuffled]

  const groups: Member[][] = Array.from({ length: targetGroupCount }, (_, i) => [shuffled[i]])
  const assigned = new Set(shuffled.slice(0, targetGroupCount).map(m => m.user_id))

  for (const member of shuffled.slice(targetGroupCount)) {
    if (assigned.has(member.user_id)) continue
    let bestGroup = -1
    let bestScore = -1
    for (let g = 0; g < groups.length; g++) {
      if (groups[g].length >= 6) continue
      const score = groups[g].reduce((sum, m) => sum + pairScoreKeyword(member, m), 0)
      if (score > bestScore) { bestScore = score; bestGroup = g }
    }
    if (bestGroup === -1) groups.push([member])
    else groups[bestGroup].push(member)
    assigned.add(member.user_id)
  }

  const small = groups.filter(g => g.length < 4)
  const ok    = groups.filter(g => g.length >= 4)
  for (const sg of small) {
    const target = ok.sort((a, b) => a.length - b.length)[0]
    if (target) target.push(...sg)
    else ok.push(sg)
  }
  return ok
}

async function formGroups(members: Member[]): Promise<{ groups: Member[][]; usedAI: boolean }> {
  if (members.length < 4) return { groups: [], usedAI: false }

  const aiResult = await aiFormGroups(members)
  if (aiResult) {
    const groups = aiResult.groups.map(idxArr => idxArr.map((i: number) => members[i]))
    return { groups, usedAI: true }
  }

  // AI failed — fall back to keyword matching
  console.log('[open-tables-match] AI grouping failed, falling back to keyword matching')
  return { groups: formGroupsKeyword(members), usedAI: false }
}

// ── Types ────────────────────────────────────────────────────────────────────

type Member = {
  user_id: string
  email: string
  first_name: string | null
  who_i_want_to_meet: string | null
  what_i_do: string | null
  building_now: string | null
}

const PROMPT = 'What are you working on right now that you could use outside perspective on?'

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('Authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()
  const period = currentMonthPeriod()

  const { count: existing } = await admin
    .from('open_table_rooms')
    .select('id', { count: 'exact', head: true })
    .eq('period', period)
  if ((existing ?? 0) > 0) {
    return NextResponse.json({ skipped: true, reason: 'rooms already created for this period' })
  }

  const { data: optins } = await admin
    .from('open_table_optins')
    .select('user_id')
    .eq('period', period)

  const userIds = (optins ?? []).map(o => o.user_id)

  const [{ data: profiles }, { data: signals }] = await Promise.all([
    admin.from('profiles')
      .select('id, first_name, what_i_do, building_now, who_i_want_to_meet')
      .in('id', userIds),
    admin.from('signals')
      .select('user_id, working_on, need_right_now')
      .in('user_id', userIds),
  ])

  const emailMap: Record<string, string> = {}
  await Promise.all(
    userIds.map(async uid => {
      const { data } = await admin.auth.admin.getUserById(uid)
      if (data.user?.email) emailMap[uid] = data.user.email
    })
  )

  const members: Member[] = userIds
    .map(uid => {
      const p = (profiles ?? []).find(x => x.id === uid)
      const s = (signals ?? []).find(x => x.user_id === uid)
      if (!p || !emailMap[uid]) return null
      return {
        user_id:            uid,
        email:              emailMap[uid],
        first_name:         p.first_name,
        who_i_want_to_meet: p.who_i_want_to_meet,
        what_i_do:          p.what_i_do,
        building_now:       p.building_now ?? s?.working_on ?? null,
      }
    })
    .filter((m): m is Member => m !== null)

  if (members.length < 4) {
    await Promise.all(
      members.map(m =>
        sendEmail(m.email, 'Open Table — not enough members this month', openTableFallbackEmail(m.first_name ?? 'there'))
      )
    )
    return NextResponse.json({ matched: 0, fallback: members.length })
  }

  const { groups, usedAI } = await formGroups(members)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  let roomsCreated = 0
  for (const group of groups) {
    const { data: room, error } = await admin
      .from('open_table_rooms')
      .insert({ period, prompt: PROMPT, expires_at: expiresAt })
      .select('id')
      .single()
    if (error || !room) continue

    await admin
      .from('open_table_members')
      .insert(group.map(m => ({ room_id: room.id, user_id: m.user_id })))

    await Promise.all(
      group.map(m =>
        sendEmail(m.email, 'Your Open Table is live', openTableStartedEmail(m.first_name ?? 'there', room.id))
      )
    )
    roomsCreated++
  }

  await recordCronRun('open-tables-match', 'ok', `matched ${members.length} members into ${roomsCreated} rooms (AI: ${usedAI})`)
  return NextResponse.json({ matched: members.length, rooms: roomsCreated, usedAI })
}
