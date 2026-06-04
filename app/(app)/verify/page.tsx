import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeConnectorScore } from '@/lib/connector-score'
import VerifyForm from './VerifyForm'

export const dynamic = 'force-dynamic'

const TIER_LABELS: Record<string, string> = {
  standard:  'Standard',
  founding:  'Founding Member',
  connector: 'Connector',
}

const REQUIREMENTS = [
  'First name set',
  '"What I do" filled in',
  '"Building now" filled in',
  'Account at least 7 days old',
]

export default async function VerifyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: profile }, { data: pricing }] = await Promise.all([
    admin
      .from('profiles')
      .select('is_verified, verification_status, founding_member, first_name, last_name, building_now, what_i_do, where_i_operate, profile_mode, created_at, username')
      .eq('id', user.id)
      .single(),
    admin.from('verification_pricing').select('tier, price_aed, stripe_price_id').eq('is_active', true),
  ])

  if (!profile) redirect('/dashboard')

  // Determine tier
  let tier = 'standard'
  if (profile.founding_member) {
    tier = 'founding'
  } else {
    const score = await computeConnectorScore(user.id)
    if (score.total >= 50) tier = 'connector'
  }

  const pricingMap = Object.fromEntries((pricing ?? []).map(p => [p.tier, p]))
  const applicablePrice = pricingMap[tier]

  // Requirements
  const ageMs   = Date.now() - new Date(profile.created_at).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  const checks  = [
    !!profile.first_name,
    !!profile.what_i_do,
    !!profile.building_now,
    ageDays >= 7,
  ]
  const allMet     = checks.every(Boolean)
  const profileSlug = profile.username ?? user.id

  // Already verified
  if (profile.is_verified) {
    return (
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white border border-border rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-navy mb-2">You are verified</h1>
          <p className="text-sm text-body-grey">Your verified badge is live on your profile.</p>
          <Link href={`/profile/${profileSlug}`} className="inline-block mt-4 text-sm font-medium text-navy hover:underline">
            View profile →
          </Link>
        </div>
      </main>
    )
  }

  // Pending approval
  if (profile.verification_status === 'pending') {
    return (
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white border border-border rounded-2xl p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-navy mb-2">Request under review</h1>
          <p className="text-sm text-body-grey">
            Your verification request has been submitted. We&apos;ll review it and get back to you within 48 hours.
          </p>
          <Link href="/dashboard" className="inline-block mt-4 text-sm font-medium text-navy hover:underline">
            Back to dashboard →
          </Link>
        </div>
      </main>
    )
  }

  // Approved — awaiting payment
  if (profile.verification_status === 'approved') {
    return (
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white border border-border rounded-2xl p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-navy mb-2">Verification approved</h1>
          <p className="text-sm text-body-grey mb-6">
            Your request has been approved. Complete your payment to receive your verified badge.
          </p>
          <Link
            href="/verify/pay"
            className="inline-block bg-navy text-warm-white px-8 py-3 rounded-full text-sm font-medium hover:bg-navy/90 transition-colors"
          >
            Complete payment →
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="font-display text-4xl font-bold text-navy mb-2">ROSTA Verified</h1>
        <p className="text-body-grey text-sm leading-relaxed">
          Verified members have been reviewed by the ROSTA team and confirmed as genuine professionals
          committed to the network. The badge signals trust and credibility to everyone you interact with.
        </p>
      </div>

      {/* Benefits */}
      <div className="bg-white border border-border rounded-2xl p-5 mb-4">
        <h2 className="font-display text-base font-bold text-navy mb-3">What you get</h2>
        <ul className="space-y-2">
          {[
            'A lime verified badge next to your name, everywhere on ROSTA',
            'Priority visibility in the member directory',
            'Signal to the network that you are who you say you are',
          ].map(b => (
            <li key={b} className="flex items-start gap-2 text-sm text-body-grey">
              <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0 mt-1.5" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      {/* Requirements */}
      <div className="bg-white border border-border rounded-2xl p-5 mb-4">
        <h2 className="font-display text-base font-bold text-navy mb-3">Requirements</h2>
        <ul className="space-y-2">
          {REQUIREMENTS.map((req, i) => (
            <li key={req} className="flex items-center gap-2 text-sm">
              {checks[i] ? (
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-body-grey/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
              <span className={checks[i] ? 'text-navy' : 'text-body-grey'}>{req}</span>
            </li>
          ))}
        </ul>
        {!allMet && (
          <p className="mt-3 text-xs text-body-grey">
            Complete the requirements above before applying.{' '}
            <Link href="/settings" className="text-navy font-medium hover:underline">Update your profile →</Link>
          </p>
        )}
      </div>

      {/* Pricing */}
      {applicablePrice && (
        <div className="bg-white border border-border rounded-2xl p-5 mb-6">
          <h2 className="font-display text-base font-bold text-navy mb-1">Your price</h2>
          <p className="text-xs text-body-grey mb-3">
            Based on your membership tier: <span className="font-medium text-navy">{TIER_LABELS[tier]}</span>
          </p>
          <div className="flex items-end gap-2">
            <p className="font-display text-4xl font-bold text-navy leading-none">
              {applicablePrice.price_aed > 0 ? `AED ${applicablePrice.price_aed.toFixed(0)}` : 'TBD'}
            </p>
            <p className="text-sm text-body-grey mb-1">one-time</p>
          </div>
          {applicablePrice.price_aed === 0 && (
            <p className="text-xs text-body-grey mt-1">Price will be confirmed when your request is reviewed.</p>
          )}
        </div>
      )}

      {/* Form or disabled state */}
      {allMet ? (
        <VerifyForm />
      ) : (
        <div className="bg-surface border border-border rounded-2xl p-6 text-center">
          <p className="text-sm text-body-grey">Complete all requirements above to apply for verification.</p>
          <Link
            href="/settings"
            className="inline-block mt-3 bg-navy text-warm-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-navy/90 transition-colors"
          >
            Update profile
          </Link>
        </div>
      )}
    </main>
  )
}
