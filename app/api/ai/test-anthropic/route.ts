import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

// Temporary diagnostic endpoint — remove after debugging
export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? ''
  const results: Record<string, unknown> = {
    keySet: !!apiKey,
    keyLength: apiKey.length,
    keyPrefix: apiKey.slice(0, 7),
  }

  const models = [
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
    'claude-3-5-haiku-20241022',
  ]

  const client = new Anthropic({ apiKey })

  for (const model of models) {
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Say: ok' }],
      })
      results[model] = { ok: true, text: (msg.content[0] as { text: string }).text }
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      results[model] = { ok: false, status: e.status, message: e.message }
    }
  }

  return NextResponse.json(results)
}
