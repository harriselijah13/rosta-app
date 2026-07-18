'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)
  const router = useRouter()

  // Supabase automatically exchanges the recovery token from the URL hash.
  // Calling getSession() confirms the session is established before showing the form.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionReady(!!session)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => router.replace('/dashboard'), 2000)
  }

  // Still waiting for session check
  if (sessionReady === null) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-border p-8 shadow-sm min-h-[200px]" />
      </div>
    )
  }

  // Token invalid or expired
  if (sessionReady === false) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-border p-8 shadow-sm text-center">
          <h1 className="font-display text-3xl font-bold text-navy mb-3">
            Link expired.
          </h1>
          <p className="text-body-grey mb-6">
            This reset link is no longer valid. Request a new one.
          </p>
          <Link href="/forgot-password" className="text-navy font-medium hover:underline text-sm">
            Request a new link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
        <h1 className="font-display text-3xl font-bold text-navy mb-2">
          Choose a new password.
        </h1>
        <p className="text-body-grey mb-8">
          Pick something you haven&apos;t used before.
        </p>

        {done ? (
          <p className="text-sm text-navy bg-lime/20 px-4 py-3 rounded-xl">
            Password updated. Taking you back in now.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="New password"
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
            <Input
              label="Confirm password"
              id="confirm"
              type="password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">
                {error}
              </p>
            )}

            <Button type="submit" loading={loading} size="lg" className="w-full mt-1">
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
