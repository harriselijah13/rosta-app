// RevenueCat webhook handler.
// verify_jwt: false — this endpoint is called by RevenueCat, not a logged-in user.
// Authentication is via a shared secret set in RevenueCat's dashboard and stored
// in Supabase secrets as REVENUECAT_WEBHOOK_SECRET.
//
// Manual setup required after deploying this function:
//   1. supabase secrets set REVENUECAT_WEBHOOK_SECRET=<your-secret>
//   2. In RevenueCat dashboard → Project Settings → Webhooks:
//      URL: https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
//      Authorization header value: <the same secret>

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Events that confirm an active paid subscription.
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Verify RevenueCat shared secret.
  const authHeader = req.headers.get('Authorization')
  const secret     = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')
  if (!secret || authHeader !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const event = body?.event as Record<string, unknown> | undefined
  if (!event?.app_user_id || !event?.type) {
    // Unknown shape — acknowledge so RevenueCat does not retry.
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const userId    = event.app_user_id as string
  const eventType = event.type         as string

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const patch = (body: Record<string, unknown>) =>
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method:  'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey':        serviceKey,
      },
      body: JSON.stringify(body),
    })

  if (GRANT_EVENTS.has(eventType)) {
    const purchasedAt = typeof event.purchased_at_ms === 'number'
      ? new Date(event.purchased_at_ms).toISOString()
      : new Date().toISOString()

    await patch({ is_premium: true, premium_since: purchasedAt })
  } else if (eventType === 'EXPIRATION') {
    // CANCELLATION is not acted on here — the user retains access until their
    // paid period expires and RevenueCat fires EXPIRATION at that point.
    await patch({ is_premium: false })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
