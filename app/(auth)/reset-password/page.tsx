'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password/update`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-7 h-7 text-navy"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-navy mb-3">Email sent</h1>
          <p className="text-body-grey mb-6">
            Check your inbox for a password reset link. It expires in 1 hour.
          </p>
          <Link href="/login" className="text-sm text-navy font-medium hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
        <h1 className="font-display text-3xl font-bold text-navy mb-2">
          Reset password
        </h1>
        <p className="text-body-grey mb-8">
          Enter your email and we&apos;ll send a reset link.
        </p>

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

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} size="lg" className="w-full mt-1">
            Send reset link
          </Button>
        </form>

        <p className="text-center text-sm text-body-grey mt-6">
          <Link href="/login" className="text-navy font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
