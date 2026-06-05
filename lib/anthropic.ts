import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
export const HAIKU = 'claude-haiku-4-5' as const

export async function aiText(prompt: string, maxTokens = 400): Promise<string | null> {
  try {
    const msg = await anthropic.messages.create({
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
