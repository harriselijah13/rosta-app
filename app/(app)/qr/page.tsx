import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { unifiedQrUrl } from '@/lib/qr'
import QRDisplay from './QRDisplay'

export default async function QRPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, username')
    .eq('id', user.id)
    .single()

  const handle = profile?.username ?? user.id
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Your'

  return (
    <div className="min-h-screen bg-warm-white flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xs text-center">
        <p className="font-display text-3xl font-bold text-navy mb-1">
          ROSTA<span className="text-lime">.</span>
        </p>
        <p className="text-body-grey text-sm mb-8">{name}&apos;s QR code</p>

        <div className="bg-white border border-border rounded-2xl p-6 mb-6 inline-block">
          <QRDisplay url={unifiedQrUrl(handle)} />
        </div>

        <p className="text-sm text-body-grey leading-relaxed">
          Anyone can scan this. Members will connect instantly.
          Guests will see your card.
        </p>
      </div>
    </div>
  )
}
