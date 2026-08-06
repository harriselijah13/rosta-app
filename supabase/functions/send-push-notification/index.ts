// send-push-notification
// Called by a pg_net trigger on notifications AFTER INSERT.
// Looks up the recipient's push token and sends an OS-level push via Expo.
// verify_jwt is true (default) — the trigger uses the anon JWT as Bearer.

const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EXPO_ACCESS_TOKEN       = Deno.env.get('EXPO_ACCESS_TOKEN') ?? null

// ── Notification type → human-readable push content ───────────────────────────

type NotificationData = Record<string, string | null | undefined>

function buildPushContent(
  type: string,
  data: NotificationData,
): { title: string; body: string } | null {
  switch (type) {
    case 'new_message':
      return {
        title: 'New message',
        body:  data.from_name ? `${data.from_name} sent you a message` : 'You have a new message',
      }
    case 'connection_request':
      return {
        title: 'Connection request',
        body:  data.from_name ? `${data.from_name} wants to connect` : 'You have a new connection request',
      }
    case 'connection_accepted':
      return {
        title: 'Connection accepted',
        body:  data.from_name ? `${data.from_name} accepted your connection request` : 'Your connection request was accepted',
      }
    case 'intro_request':
      return {
        title: 'Intro request',
        body:  'Someone wants to make an introduction involving you',
      }
    case 'intro_incoming':
      return {
        title: 'New introduction',
        body:  'You have a new introduction waiting',
      }
    case 'invite_request':
      return {
        title: 'New invite request',
        body:  data.full_name ? `${data.full_name} has requested an invite` : 'Someone has requested an invite',
      }
    case 'reaction_can_help':
    case 'reaction_know_someone':
      return {
        title: 'Someone reacted to your post',
        body:  type === 'reaction_can_help' ? 'Someone said they can help' : 'Someone knows someone who can help',
      }
    case 'post_forwarded':
      return {
        title: 'Post forwarded to you',
        body:  data.from_name ? `${data.from_name} forwarded a post to you` : 'A post was forwarded to you',
      }
    case 'profile_viewed':
      return {
        title: 'New profile view',
        body:  data.from_name ? `${data.from_name} viewed your profile` : 'Someone viewed your profile',
      }
    case 'lend_a_hand':
      return {
        title: 'New ask from your network',
        body:  data.from_name ? `${data.from_name} has a new ask` : 'Someone in your network posted an ask',
      }
    default:
      // Unknown or future type — skip push rather than send a confusing message
      return null
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const row: {
      id:         string
      user_id:    string
      type:       string
      data:       NotificationData
      created_at: string
    } = await req.json()

    if (!row?.user_id || !row?.type) {
      return new Response(JSON.stringify({ error: 'missing user_id or type' }), { status: 400 })
    }

    const content = buildPushContent(row.type, row.data ?? {})
    if (!content) {
      // Recognised type with no push needed (e.g. whatsapp_share), or unknown type
      return new Response(JSON.stringify({ skipped: true, type: row.type }), { status: 200 })
    }

    // Look up push token using service role key to bypass RLS
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${row.user_id}&select=push_token`,
      {
        headers: {
          apikey:          SUPABASE_SERVICE_KEY,
          Authorization:   `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type':  'application/json',
        },
      }
    )

    const profiles: { push_token: string | null }[] = await profileRes.json()
    const pushToken = profiles?.[0]?.push_token ?? null

    if (!pushToken) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_push_token' }), { status: 200 })
    }

    // Send via Expo Push API
    const expoHeaders: Record<string, string> = {
      Accept:          'application/json',
      'Content-Type':  'application/json',
    }
    if (EXPO_ACCESS_TOKEN) {
      expoHeaders['Authorization'] = `Bearer ${EXPO_ACCESS_TOKEN}`
    }

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: expoHeaders,
      body: JSON.stringify({
        to:    pushToken,
        sound: 'default',
        title: content.title,
        body:  content.body,
        data:  { type: row.type, ...row.data },
      }),
    })

    const expoBody = await expoRes.json()
    return new Response(JSON.stringify({ ok: true, expo: expoBody }), { status: 200 })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
