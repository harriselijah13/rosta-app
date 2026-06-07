import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function EventReportPage({ params }: { params: { codeId: string } }) {
  const admin = createAdminClient()

  const { data: code } = await admin
    .from('invite_codes')
    .select('id, event_name, label, event_date, event_location, organiser_name, organiser_email')
    .eq('id', params.codeId)
    .eq('type', 'guest_qr')
    .single()

  if (!code) notFound()

  const eventName = code.event_name ?? code.label ?? 'Unnamed event'

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Link
        href="/admin/event-tools"
        className="text-sm text-body-grey hover:text-navy transition-colors mb-6 inline-flex items-center gap-1"
      >
        ← Back to Event Tools
      </Link>

      <div className="bg-white border border-border rounded-2xl p-8 mt-4 text-center">
        <h1 className="font-display text-2xl font-bold text-navy mb-2">{eventName}</h1>
        <p className="text-sm text-body-grey">Full event report — coming in the next build.</p>
      </div>
    </div>
  )
}
