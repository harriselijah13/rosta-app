'use client'

import { useState, useTransition } from 'react'
import { submitVerificationRequest } from './actions'

const MAX = 300

export default function VerifyForm() {
  const [statement, setStatement] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError]         = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!statement.trim()) return
    setError('')
    startTransition(async () => {
      const result = await submitVerificationRequest(statement)
      if (result.error) {
        setError(result.error)
      } else {
        setSubmitted(true)
      }
    })
  }

  if (submitted) {
    return (
      <div className="bg-white border border-border rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-navy mb-2">Request submitted</h2>
        <p className="text-sm text-body-grey max-w-xs mx-auto">
          Your request has been submitted. We&apos;ll review it and get back to you within 48 hours.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-border rounded-2xl p-6">
      <h2 className="font-display text-xl font-bold text-navy mb-1">Apply for verification</h2>
      <p className="text-sm text-body-grey mb-5">Tell us a bit about why you want to be verified.</p>

      <div className="mb-4">
        <label htmlFor="statement" className="block text-sm font-medium text-navy mb-1.5">
          Why do you want to be verified?
        </label>
        <textarea
          id="statement"
          value={statement}
          onChange={e => setStatement(e.target.value.slice(0, MAX))}
          placeholder="I want to be verified because..."
          rows={4}
          required
          className="w-full px-4 py-3 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors resize-none text-sm"
        />
        <p className={`text-xs mt-1 text-right ${statement.length >= MAX ? 'text-red-500' : 'text-body-grey'}`}>
          {statement.length}/{MAX}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl mb-4">{error}</p>
      )}

      <button
        type="submit"
        disabled={!statement.trim() || isPending}
        className="w-full bg-navy text-warm-white py-3 rounded-full text-sm font-medium hover:bg-navy/90 transition-colors disabled:opacity-40"
      >
        {isPending ? 'Submitting...' : 'Submit request'}
      </button>
    </form>
  )
}
