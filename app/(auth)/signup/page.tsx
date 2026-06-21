'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

function SignupForm() {
  const searchParams = useSearchParams()
  const prefillCode  = searchParams.get('invite') ?? ''

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const router = useRouter()

  // Pre-fill from ?invite= param on mount
  useEffect(() => {
    if (prefillCode) setInviteCode(prefillCode.toUpperCase())
  }, [prefillCode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!inviteCode.trim()) {
      setError('An invite code is required to join ROSTA.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, inviteCode }),
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      setError(data.error || 'Something went wrong.')
      setLoading(false)
      return
    }

    router.push('/check-email')
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
        <h1 className="font-display text-3xl font-bold text-navy mb-2">
          Create your account
        </h1>
        <p className="text-body-grey mb-8">Join the ROSTA network.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            label="Email"
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            id="password"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
          <div>
            <Input
              label="Invite code"
              id="invite-code"
              type="text"
              placeholder="e.g. MSCA2GAC"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase())}
              required
            />
            {prefillCode && (
              <p className="text-xs text-body-grey mt-1">
                Code pre-filled from your invite link.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">
              {error}
            </p>
          )}

          <Button
            type="submit"
            loading={loading}
            size="lg"
            className="w-full mt-1"
            disabled={!inviteCode.trim()}
          >
            Create account
          </Button>
          <p className="text-center text-xs text-body-grey leading-relaxed">
            By joining you agree to our{' '}
            <Link href="/terms" className="underline underline-offset-2 hover:text-navy transition-colors">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-navy transition-colors">Privacy Policy</Link>.
          </p>
        </form>

        <p className="text-center text-sm text-body-grey mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-navy font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
