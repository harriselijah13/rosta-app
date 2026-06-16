import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function OpenTablesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // If the user is already in an active room, send them there
  const { data: membership } = await admin
    .from('open_table_members')
    .select('room_id, open_table_rooms(id, expires_at)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership) {
    type RoomRef = { id: string; expires_at: string }
    const raw = (membership as unknown as { open_table_rooms: RoomRef | RoomRef[] | null }).open_table_rooms
    const room = Array.isArray(raw) ? raw[0] ?? null : raw
    if (room && room.expires_at > now) redirect(`/open-tables/${room.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-display text-4xl font-bold text-navy mb-8">Open Tables</h1>
      <div className="bg-white border border-border rounded-2xl p-8">
        <h2 className="font-display text-xl font-bold text-navy mb-3">Open Tables</h2>
        <p className="text-sm text-body-grey leading-relaxed mb-5">
          Once a month, ROSTA matches you with a small group of members — usually 4 to 6 people — based on your signals and what you&apos;re working on. You get a private conversation room for 7 days with a simple prompt to get things started. You don&apos;t choose who&apos;s in the group. That&apos;s the point — it&apos;s how you meet people you wouldn&apos;t have found on your own. Opt in below and you&apos;ll be matched in the next round.
        </p>
        <Link
          href="/settings#open-table"
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-navy text-warm-white px-5 py-2.5 rounded-full hover:bg-navy/90 transition-colors"
        >
          Opt in to the next Open Table
        </Link>
      </div>
    </div>
  )
}
