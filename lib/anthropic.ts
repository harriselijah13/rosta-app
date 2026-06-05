import Anthropic from '@anthropic-ai/sdk'

export const HAIKU = 'claude-haiku-4-5' as const

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

export async function aiText(prompt: string, maxTokens = 400): Promise<string | null> {
  try {
    const msg = await client().messages.create({
      model:      HAIKU,
      max_tokens: maxTokens,
      messages:   [{ role: 'user', content: prompt }],
    })
    const block = msg.content[0]
    return block.type === 'text' ? block.text.trim() : null
  } catch (err) {
    console.error('[anthropic] aiText failed', err)
    return null
  }
}
