'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function CheckoutForm({ priceAed }: { priceAed: number }) {
  const stripe   = useStripe()
  const elements = useElements()
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/verify/pay`,
      },
    })

    // Only reached on error — success causes a redirect
    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-surface/50 border border-border rounded-xl p-4">
        <PaymentElement
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card'],
          }}
        />
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || loading}
        className="w-full bg-navy text-warm-white py-3.5 rounded-full text-sm font-semibold hover:bg-navy/90 transition-colors disabled:opacity-40"
      >
        {loading ? 'Processing...' : `Pay AED ${priceAed.toFixed(2)}`}
      </button>

      <p className="text-center text-xs text-body-grey">
        Payments are processed securely by Stripe. Statement descriptor: ROSTA.
      </p>
    </form>
  )
}

export default function PaymentForm({
  clientSecret,
  priceAed,
}: {
  clientSecret: string
  priceAed: number
}) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'flat',
          variables: {
            colorPrimary:     '#0F1B3C',
            colorBackground:  '#FFFFFF',
            colorText:        '#0F1B3C',
            colorDanger:      '#ef4444',
            fontFamily:       'system-ui, sans-serif',
            borderRadius:     '12px',
          },
        },
      }}
    >
      <CheckoutForm priceAed={priceAed} />
    </Elements>
  )
}
