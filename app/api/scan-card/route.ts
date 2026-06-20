import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const VALID_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type ImageMime = (typeof VALID_TYPES)[number]

const PROMPT =
  'Extract the contact information from this business card. ' +
  'Return only JSON with fields: name, email, company, role, phone. ' +
  'If a field is not visible return null. Return nothing else.'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { imageBase64, mimeType } = body ?? {}

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 })
  }

  const safeMime: ImageMime = VALID_TYPES.includes(mimeType) ? mimeType : 'image/jpeg'

  // ── DIAGNOSTIC LOGGING — remove once root cause is confirmed ─────────────
  console.log('[scan-card] incoming', {
    mimeType,
    safeMime,
    mimeTypeMatch: VALID_TYPES.includes(mimeType),
    base64LengthChars: imageBase64.length,
    approxFileSizeKB: Math.round(imageBase64.length * 0.75 / 1024),
    base64Prefix: imageBase64.substring(0, 16),
  })
  // ─────────────────────────────────────────────────────────────────────────

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: safeMime, data: imageBase64 },
          },
          { type: 'text', text: PROMPT },
        ],
      }],
    })

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Could not read card' }, { status: 422 })

    const parsed = JSON.parse(match[0])
    return NextResponse.json({
      name:    parsed.name    ?? null,
      email:   parsed.email   ?? null,
      company: parsed.company ?? null,
      role:    parsed.role    ?? null,
      phone:   parsed.phone   ?? null,
    })
  } catch (err: unknown) {
    // ── DIAGNOSTIC LOGGING — remove once root cause is confirmed ─────────────
    const anthErr = err as Record<string, unknown>
    console.error('[scan-card] Anthropic error', {
      message:    anthErr?.message,
      name:       anthErr?.name,
      status:     anthErr?.status,
      error:      anthErr?.error,
      headers:    anthErr?.headers,
      mimeType,
      safeMime,
      approxFileSizeKB: Math.round(imageBase64.length * 0.75 / 1024),
    })
    // ─────────────────────────────────────────────────────────────────────────
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 })
  }
}
