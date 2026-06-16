'use server'

import { cookies } from 'next/headers'

export async function markIntroPageVisited() {
  cookies().set('intro-last-visited', new Date().toISOString(), {
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
}
