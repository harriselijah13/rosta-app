'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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

    router.push('/login?message=password_updated')
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
        <h1 className="font-display text-3xl font-bold text-navy mb-2">
          Set new password
        </h1>
        <p className="text-body-grey mb-8">
          Choose a strong password for your account.
        </p>

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
      </div>
    </div>
  )
}
