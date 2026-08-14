import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function MemberCardPage({ params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) notFound()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, first_name, last_name, what_i_do, avatar_url, where_i_operate, is_verified')
    .eq('id', params.id)
    .single()

  if (!profile) notFound()

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'ROSTA member'
  const initials = [profile.first_name?.[0], profile.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'

  return (
    <main style={{
      minHeight: '100dvh',
      backgroundColor: '#0F1B3C',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      fontFamily: 'var(--font-plus-jakarta-sans, system-ui, sans-serif)',
    }}>
      {/* Card */}
      <div style={{
        backgroundColor: '#FDFAF6',
        borderRadius: 20,
        padding: '32px 28px',
        width: '100%',
        maxWidth: 380,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
      }}>
        {/* Avatar */}
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          overflow: 'hidden',
          backgroundColor: '#0F1B3C',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          flexShrink: 0,
        }}>
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={name}
              width={80}
              height={80}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          ) : (
            <span style={{
              fontFamily: 'var(--font-fraunces, Georgia, serif)',
              fontSize: 28,
              color: '#FDFAF6',
              lineHeight: 1,
            }}>{initials}</span>
          )}
        </div>

        {/* Name */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: profile.what_i_do ? 6 : 16,
        }}>
          <h1 style={{
            fontFamily: 'var(--font-fraunces, Georgia, serif)',
            fontSize: 26,
            color: '#0F1B3C',
            margin: 0,
            lineHeight: 1.2,
            textAlign: 'center',
          }}>{name}</h1>
          {profile.is_verified && (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-label="Verified">
              <circle cx="10" cy="10" r="10" fill="#C8F53C"/>
              <path d="M6 10.5l2.5 2.5L14 8" stroke="#0F1B3C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>

        {/* What they do */}
        {profile.what_i_do && (
          <p style={{
            fontFamily: 'var(--font-plus-jakarta-sans, system-ui, sans-serif)',
            fontSize: 14,
            color: '#6B6560',
            textAlign: 'center',
            margin: '0 0 4px',
            lineHeight: 1.5,
          }}>{profile.what_i_do}</p>
        )}

        {/* Location */}
        {profile.where_i_operate && (
          <p style={{
            fontFamily: 'var(--font-plus-jakarta-sans, system-ui, sans-serif)',
            fontSize: 13,
            color: '#9E9994',
            textAlign: 'center',
            margin: '0 0 20px',
          }}>{profile.where_i_operate}</p>
        )}
        {!profile.where_i_operate && <div style={{ height: 20 }} />}

        {/* Divider */}
        <div style={{ width: '100%', height: 1, backgroundColor: '#E8E3DD', marginBottom: 20 }} />

        {/* ROSTA wordmark */}
        <p style={{
          fontFamily: 'var(--font-fraunces, Georgia, serif)',
          fontSize: 11,
          letterSpacing: '0.15em',
          color: '#9E9994',
          margin: '0 0 16px',
          textTransform: 'uppercase',
        }}>on ROSTA</p>

        {/* CTA */}
        <Link
          href="https://apps.apple.com/app/rosta/id6743366481"
          style={{
            display: 'block',
            width: '100%',
            backgroundColor: '#0F1B3C',
            color: '#FDFAF6',
            borderRadius: 100,
            padding: '14px 0',
            textAlign: 'center',
            fontFamily: 'var(--font-plus-jakarta-sans, system-ui, sans-serif)',
            fontWeight: 600,
            fontSize: 15,
            textDecoration: 'none',
            marginBottom: 10,
          }}
        >
          Download ROSTA to connect
        </Link>

        <Link
          href="/join"
          style={{
            display: 'block',
            width: '100%',
            color: '#6B6560',
            borderRadius: 100,
            padding: '10px 0',
            textAlign: 'center',
            fontFamily: 'var(--font-plus-jakarta-sans, system-ui, sans-serif)',
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Request an invite
        </Link>
      </div>

      {/* Footer */}
      <p style={{
        fontFamily: 'var(--font-fraunces, Georgia, serif)',
        fontSize: 12,
        color: 'rgba(255,255,255,0.35)',
        marginTop: 24,
        letterSpacing: '0.1em',
      }}>ROSTA</p>
    </main>
  )
}
