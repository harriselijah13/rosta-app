import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, openTableStartedEmail, openTableFallbackEmail } from '@/lib/resend'
import { recordCronRun } from '@/lib/cron-recorder'

export const dynamic = 'force-dynamic'

function currentMonthPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Simple tokeniser: lowercase words ≥ 3 chars, no stopwords
const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'are', 'this', 'have', 'from', 'they', 'will', 'been', 'has', 'but', 'not', 'can', 'who', 'all', 'our', 'its', 'you', 'your'])
function tokens(text: string | null): Set<string> {
  if (!text) return new Set()
  return new Set(
    text.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 3 && !STOP.has(w))
  )
}

function overlap(a: Set<string>, b: Set<string>): number {
  return Array.from(a).filter(t => b.has(t)).length
}

// Score how complementary A is to B:
// A's "who I want to meet" matching B's work/building
function complementScore(
  aWhoIWantToMeet: string | null,
  bWhatIDo: string | null,
  bBuildingNow: string | null,
): number {
  const want = tokens(aWhoIWantToMeet)
  const offer = new Set(Array.from(tokens(bWhatIDo)).concat(Array.from(tokens(bBuildingNow))))
  return overlap(want, offer)
}

// Pair score (bidirectional)
function pairScore(a: Member, b: Member): number {
  return complementScore(a.who_i_want_to_meet, b.what_i_do, b.building_now)
       + complementScore(b.who_i_want_to_meet, a.what_i_do, a.building_now)
}

type Member = {
  user_id: string
  email: string
  first_name: string | null
  who_i_want_to_meet: string | null
  what_i_do: string | null
  building_now: string | null
}

// Greedy grouping: form groups of 4–6, maximising internal complementarity
function formGroups(members: Member[]): Member[][] {
  if (members.length < 4) return []

  const n = members.length
  const targetGroupCount = Math.round(n / 5) || 1 // aim for groups of ~5
  const shuffled = [...members].sort(() => Math.random() - 0.5)

  if (n <= 6) return [shuffled]

  // Seed each group with one member, then fill greedily
  const groups: Member[][] = Array.from({ length: targetGroupCount }, (_, i) => [shuffled[i]])
  const assigned = new Set(shuffled.slice(0, targetGroupCount).map(m => m.user_id))

  for (const member of shuffled.slice(targetGroupCount)) {
    if (assigned.has(member.user_id)) continue

    // Find the group where this member has the highest aggregate complement score
    // and that still has capacity (< 6 members)
    let bestGroup = -1
    let bestScore = -1
    for (let g = 0; g < groups.length; g++) {
      if (groups[g].length >= 6) continue
      const score = groups[g].reduce((sum, m) => sum + pairScore(member, m), 0)
      if (score > bestScore) { bestScore = score; bestGroup = g }
    }

    if (bestGroup === -1) {
      // All groups at capacity — start a new one only if it won't be too small
      groups.push([member])
    } else {
      groups[bestGroup].push(member)
    }
    assigned.add(member.user_id)
  }

  // Merge any group that ended up with < 4 into the smallest existing group
  const small = groups.filter(g => g.length < 4)
  const ok = groups.filter(g => g.length >= 4)
  for (const sg of small) {
    const target = ok.sort((a, b) => a.length - b.length)[0]
    if (target) target.push(...sg)
    else ok.push(sg) // shouldn't happen but keep it
  }

  return ok
}

const PROMPT = 'What are you working on right now that you could use outside perspective on?'

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

  // Guard: don't double-run if rooms already exist for this period
  const { count: existing } = await admin
    .from('open_table_rooms')
    .select('id', { count: 'exact', head: true })
    .eq('period', period)
  if ((existing ?? 0) > 0) {
    return NextResponse.json({ skipped: true, reason: 'rooms already created for this period' })
  }

  // Fetch opted-in user IDs for this period
  const { data: optins } = await admin
    .from('open_table_optins')
    .select('user_id')
    .eq('period', period)

  const userIds = (optins ?? []).map(o => o.user_id)

  // Fetch profiles + signals for opted-in members in parallel
  const [{ data: profiles }, { data: signals }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, first_name, what_i_do, building_now, who_i_want_to_meet')
      .in('id', userIds),
    admin
      .from('signals')
      .select('user_id, working_on, need_right_now')
      .in('user_id', userIds),
  ])

  // Fetch auth emails via admin auth API
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
        user_id: uid,
        email: emailMap[uid],
        first_name: p.first_name,
        who_i_want_to_meet: p.who_i_want_to_meet,
        what_i_do: p.what_i_do,
        building_now: p.building_now ?? s?.working_on ?? null,
      }
    })
    .filter((m): m is Member => m !== null)

  // Not enough members — send fallback emails
  if (members.length < 4) {
    await Promise.all(
      members.map(m =>
        sendEmail(
          m.email,
          'Open Table — not enough members this month',
          openTableFallbackEmail(m.first_name ?? 'there'),
        )
      )
    )
    return NextResponse.json({ matched: 0, fallback: members.length })
  }

  const groups = formGroups(members)
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
        sendEmail(
          m.email,
          'Your Open Table is live',
          openTableStartedEmail(m.first_name ?? 'there', room.id),
        )
      )
    )
    roomsCreated++
  }

  await recordCronRun('open-tables-match', 'ok', `matched ${members.length} members into ${roomsCreated} rooms`)
  return NextResponse.json({ matched: members.length, rooms: roomsCreated })
}
