'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInviteToken } from '@/lib/invite'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Forbidden')
  return admin
}

export async function revokeCode(codeId: string) {
  const admin = await requireAdmin()
  await admin.from('invite_codes').delete().eq('id', codeId)
  revalidatePath('/admin/invite-codes')
}

export async function generateCodeForMember(userId: string): Promise<string> {
  const admin = await requireAdmin()
  const token = generateInviteToken()
  await admin.from('invite_codes').insert({ owner_id: userId, token, type: 'founding_invite' })
  revalidatePath('/admin/invite-codes')
  return token
}
