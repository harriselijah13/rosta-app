import Link from 'next/link'
import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import JoinRequestForm from './JoinRequestForm'

// ── Code landing (server-resolved) ───────────────────────────────────────────

async function InviteCodeLanding({ code }: { code: string }) {
  const admin = createAdminClient()
  const upper = code.trim().toUpperCase()

  const { data: codeRow } = await admin
    .from('invite_codes')
    .select('id, owner_id, used_at, type')
    .eq('token', upper)
    .eq('type', 'founding_invite')
    .maybeSingle()

  // Malformed / not found
  if (!codeRow) {
    return (
      <div className="min-h-screen bg-warm-white flex flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-xl font-bold text-navy mb-6">
          ROSTA<span className="text-lime">.</span>
        </p>
        <p className="text-navy font-semibold mb-2">This invite link isn&apos;t valid.</p>
        <p className="text-body-grey text-sm mb-6">Check the link and try again, or ask the person who invited you for a new one.</p>
        <Link href="/signup" className="text-sm text-navy underline underline-offset-2">
          Go to sign up
        </Link>
      </div>
    )
  }

  // Fetch inviter name regardless (used for both states)
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('first_name')
    .eq('id', codeRow.owner_id)
    .single()

  const inviterName = ownerProfile?.first_name ?? null

  // Already used
  if (codeRow.used_at) {
    return (
      <div className="min-h-screen bg-warm-white flex flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-xl font-bold text-navy mb-6">
          ROSTA<span className="text-lime">.</span>
        </p>
        <p className="text-navy font-semibold mb-2">This invite code has already been used.</p>
        <p className="text-body-grey text-sm">
          {inviterName
            ? `Ask ${inviterName} for a new one.`
            : 'Ask the person who invited you for a new one.'}
        </p>
      </div>
    )
  }

  // Valid — show landing with inviter context
  return (
    <div className="min-h-screen bg-warm-white">
      <div className="bg-white border-b border-border px-6 py-4 sticky top-0 z-10">
        <p className="font-display text-xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </p>
      </div>

      <div className="max-w-sm mx-auto px-6 py-12 text-center">
        {inviterName && (
          <p className="text-sm text-body-grey mb-6">
            Invited by {inviterName}
          </p>
        )}

        <h1 className="font-display text-3xl font-black text-navy mb-4 leading-tight">
          You&apos;ve been invited to ROSTA.
        </h1>
        <p className="text-sm text-body-grey leading-relaxed mb-10">
          A professional network built around real introductions and real conversations.
          No feed. No cold connects. Invite-only.
        </p>

        <Link
          href={`/signup?invite=${upper}`}
          className="inline-block w-full py-3.5 bg-lime text-navy font-semibold text-sm rounded-full hover:bg-lime/90 transition-colors"
        >
          Accept invite
        </Link>

        <p className="text-xs text-body-grey mt-5">
          Your code: <span className="font-mono font-semibold">{upper}</span>
        </p>
      </div>
    </div>
  )
}

// ── Page entry point (server component) ──────────────────────────────────────

export default async function JoinPage({
  searchParams,
}: {
  searchParams: { code?: string; ref?: string }
}) {
  if (searchParams.code) {
    return <InviteCodeLanding code={searchParams.code} />
  }

  return (
    <Suspense>
      <JoinRequestForm ref_={searchParams.ref ?? ''} />
    </Suspense>
  )
}
