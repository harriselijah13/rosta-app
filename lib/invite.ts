import { randomBytes } from 'crypto'
import { createAdminClient } from './supabase/admin'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0,1,I,O

export function generateInviteToken(): string {
  const bytes = randomBytes(8)
  return Array.from(bytes).map(b => CHARS[b % CHARS.length]).join('')
}

export async function ensureInviteCodes(userId: string): Promise<void> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('invite_codes')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('type', 'founding_invite')

  const existing = count ?? 0
  if (existing >= 5) return

  const needed = 5 - existing
  await admin.from('invite_codes').insert(
    Array.from({ length: needed }, () => ({
      owner_id: userId,
      token: generateInviteToken(),
      type: 'founding_invite',
    })),
  )
}
