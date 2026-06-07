import { createAdminClient } from '@/lib/supabase/admin'
import EventToolsClient, { type EventCode } from './EventToolsClient'

export const dynamic = 'force-dynamic'

export default async function EventToolsPage() {
  const admin = createAdminClient()
  const now   = new Date().toISOString()

  // Fetch codes, guest connections, and all connections in parallel
  const [
    { data: codes },
    { data: guestConns },
    { data: allConnections },
    { data: allOutcomes },
    { data: allConversations },
  ] = await Promise.all([
    admin
      .from('invite_codes')
      .select(`id, token, owner_id, label, created_at, expires_at,
               event_name, event_date, event_location,
               organiser_name, organiser_email, event_notes`)
      .eq('type', 'guest_qr')
      .order('created_at', { ascending: false }),
    admin
      .from('guest_connections')
      .select('id, invite_code_id, guest_name, guest_email, guest_what_i_do, created_at'),
    admin
      .from('connections')
      .select('id, user_a, user_b'),
    admin
      .from('outcomes')
      .select('id, conversation_id'),
    admin
      .from('conversations')
      .select('id, user_a, user_b'),
  ])

  // Cross-reference guest emails → member profiles
  // Collect all unique guest emails across all codes
  const allGuestEmails = Array.from(new Set((guestConns ?? []).map(gc => gc.guest_email?.toLowerCase()).filter(Boolean)))

  // Look up which emails have a matching auth user
  const emailToUserId: Record<string, string> = {}
  if (allGuestEmails.length > 0) {
    // Fetch auth users in pages (Supabase admin.listUsers is paginated)
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 })
    const users = usersData?.users ?? []
    for (const u of users) {
      if (u.email) emailToUserId[u.email.toLowerCase()] = u.id
    }
  }

  // Build a set of all member IDs for fast lookup
  // Conversation lookup: conversationId → parties
  const convById: Record<string, { user_a: string; user_b: string }> = {}
  for (const c of allConversations ?? []) convById[c.id] = { user_a: c.user_a, user_b: c.user_b }

  // Outcome → conversation parties
  const outcomeConvIds = (allOutcomes ?? []).map(o => o.conversation_id)

  // Group guest connections by code
  type GuestConn = { id: string; invite_code_id: string; guest_name: string; guest_email: string; guest_what_i_do: string; created_at: string }
  const gcByCode: Record<string, GuestConn[]> = {}
  for (const gc of guestConns ?? []) {
    if (!gcByCode[gc.invite_code_id]) gcByCode[gc.invite_code_id] = []
    gcByCode[gc.invite_code_id].push(gc)
  }

  const eventCodes: EventCode[] = (codes ?? []).map(code => {
    const codeGuestConns = gcByCode[code.id] ?? []

    // Members who joined: guests whose email matches an auth user
    const joinedMemberIds = Array.from(new Set(
      codeGuestConns
        .map(gc => emailToUserId[gc.guest_email?.toLowerCase()])
        .filter((id): id is string => !!id)
    ))

    const memberIdSet = new Set(joinedMemberIds)

    // Connections involving any joined member
    const memberConnectionCount = (allConnections ?? []).filter(
      c => memberIdSet.has(c.user_a) || memberIdSet.has(c.user_b)
    ).length

    // Outcomes from conversations involving joined members
    let memberOutcomeCount = 0
    for (const convId of outcomeConvIds) {
      const conv = convById[convId]
      if (conv && (memberIdSet.has(conv.user_a) || memberIdSet.has(conv.user_b))) {
        memberOutcomeCount++
      }
    }

    return {
      id:              code.id,
      token:           code.token,
      label:           code.label,
      event_name:      code.event_name ?? null,
      event_date:      code.event_date ?? null,
      event_location:  code.event_location ?? null,
      organiser_name:  code.organiser_name ?? null,
      organiser_email: code.organiser_email ?? null,
      event_notes:     code.event_notes ?? null,
      created_at:      code.created_at,
      expires_at:      code.expires_at,
      is_expired:      code.expires_at < now,
      stats: {
        scans:       codeGuestConns.length,
        members:     joinedMemberIds.length,
        connections: memberConnectionCount,
        outcomes:    memberOutcomeCount,
      },
      connections: codeGuestConns.map(gc => ({
        id:              gc.id,
        guest_name:      gc.guest_name,
        guest_email:     gc.guest_email,
        guest_what_i_do: gc.guest_what_i_do,
        created_at:      gc.created_at,
        became_member:   !!emailToUserId[gc.guest_email?.toLowerCase()],
      })),
    }
  })

  return <EventToolsClient codes={eventCodes} />
}
