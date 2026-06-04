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

export async function setFoundingMember(userId: string, value: boolean) {
  const admin = await requireAdmin()
  await admin.from('profiles').update({ founding_member: value }).eq('id', userId)
  revalidatePath('/admin/members')
}

export async function generateInviteCode(userId: string): Promise<string> {
  const admin = await requireAdmin()
  const token = generateInviteToken()
  await admin.from('invite_codes').insert({ owner_id: userId, token, type: 'founding_invite' })
  revalidatePath('/admin/members')
  return token
}

export async function removeMember(userId: string) {
  const admin = await requireAdmin()
  // Delete profile first (other tables cascade from profiles)
  await admin.from('profiles').delete().eq('id', userId)
  // Delete auth user
  await admin.auth.admin.deleteUser(userId)
  revalidatePath('/admin/members')
}
