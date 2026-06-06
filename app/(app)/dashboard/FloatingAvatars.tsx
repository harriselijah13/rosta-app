'use client'

type AvatarData = { initials: string; avatar_url: string | null }

// Fixed positions: edges of the hero panel, well clear of centre text
const SLOTS = [
  { top: '14%',    left: '2.5%',  duration: '28s', delay: '0s'    },
  { top: '22%',    right: '2.5%', duration: '23s', delay: '4s'    },
  { bottom: '22%', left: '3%',    duration: '31s', delay: '8s'    },
  { bottom: '14%', right: '2%',   duration: '25s', delay: '2s'    },
]

// Placeholder gradient backgrounds when no avatar/initials available
const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(135deg, rgba(200,245,60,0.25), rgba(15,27,60,0.4))',
  'linear-gradient(135deg, rgba(15,27,60,0.4), rgba(200,245,60,0.2))',
  'linear-gradient(135deg, rgba(200,245,60,0.15), rgba(15,27,60,0.5))',
  'linear-gradient(135deg, rgba(15,27,60,0.5), rgba(200,245,60,0.15))',
]

export default function FloatingAvatars({ profiles }: { profiles: AvatarData[] }) {
  return (
    <>
      {SLOTS.map((slot, i) => {
        const profile = profiles[i] ?? null
        const { duration, delay, ...pos } = slot
        return (
          <div
            key={i}
            aria-hidden="true"
            className="absolute avatar-float pointer-events-none"
            style={{
              ...pos,
              '--float-duration': duration,
              '--float-delay': delay,
              opacity: 0.55,
            } as unknown as React.CSSProperties}
          >
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt=""
                className="w-9 h-9 rounded-full object-cover border-2 border-white/20"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center"
                style={{ background: PLACEHOLDER_GRADIENTS[i] }}
              >
                {profile?.initials ? (
                  <span className="text-[11px] font-semibold text-white/70">
                    {profile.initials}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
