import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import FacilitateForm from './FacilitateForm'

export default async function FacilitatePage({
  params,
}: {
  params: { memberAId: string; memberBId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { memberAId, memberBId } = params
  if (memberAId === memberBId || memberAId === user.id || memberBId === user.id) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, what_i_do, username, onboarding_completed')
    .in('id', [memberAId, memberBId])

  const memberA = profiles?.find(p => p.id === memberAId)
  const memberB = profiles?.find(p => p.id === memberBId)
  if (!memberA?.onboarding_completed || !memberB?.onboarding_completed) notFound()

  // Verify facilitator is connected to both
  const [[fAa, fAb], [fBa, fBb]] = [
    [user.id, memberAId].sort() as [string, string],
    [user.id, memberBId].sort() as [string, string],
  ]
  const [{ data: connA }, { data: connB }] = await Promise.all([
    admin.from('connections').select('id').eq('user_a', fAa).eq('user_b', fAb).maybeSingle(),
    admin.from('connections').select('id').eq('user_a', fBa).eq('user_b', fBb).maybeSingle(),
  ])

  const nameA = [memberA.first_name, memberA.last_name].filter(Boolean).join(' ') || 'this member'
  const nameB = [memberB.first_name, memberB.last_name].filter(Boolean).join(' ') || 'this member'

  if (!connA || !connB) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-body-grey hover:text-navy transition-colors mb-8">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <div className="bg-white border border-border rounded-2xl p-8 text-center">
          <p className="text-navy font-medium mb-2">You can only introduce people you&apos;re connected to</p>
          <p className="text-sm text-body-grey">
            You need to be connected to both {nameA} and {nameB} to make this introduction.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-body-grey hover:text-navy transition-colors mb-8">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-navy">
          Introduce {nameA} to {nameB}
        </h1>
        <p className="text-body-grey mt-2 text-sm">
          Both members will be notified and you&apos;ll be credited for the connection.
        </p>
      </div>

      <FacilitateForm
        memberA={{ id: memberA.id, name: nameA, avatarUrl: memberA.avatar_url, whatIDo: memberA.what_i_do }}
        memberB={{ id: memberB.id, name: nameB, avatarUrl: memberB.avatar_url, whatIDo: memberB.what_i_do }}
      />
    </div>
  )
}
