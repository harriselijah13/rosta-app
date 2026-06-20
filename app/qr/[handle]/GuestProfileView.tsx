import Link from 'next/link'

interface Props {
  handle: string
  name: string
  initials: string
  avatarUrl: string | null
  whatIDo: string | null
  workingOn: string | null
}

export default function GuestProfileView({
  handle,
  name,
  initials,
  avatarUrl,
  whatIDo,
  workingOn,
}: Props) {
  return (
    <div className="min-h-screen bg-warm-white">
      {/* Header */}
      <div className="bg-white border-b border-border px-6 py-4 sticky top-0 z-10">
        <p className="font-display text-xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </p>
      </div>

      <div className="max-w-sm mx-auto px-6 py-8">
        {/* Profile card */}
        <div className="bg-white border border-border rounded-2xl p-8 text-center mb-4">
          <div className="mb-5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="w-20 h-20 rounded-full object-cover mx-auto"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-navy/10 text-navy text-xl font-semibold flex items-center justify-center mx-auto">
                {initials}
              </div>
            )}
          </div>

          <h1 className="font-display text-2xl font-bold text-navy mb-1">{name}</h1>
          {whatIDo && <p className="text-body-grey text-sm mb-4">{whatIDo}</p>}

          {workingOn && (
            <div className="text-left bg-surface border border-border rounded-xl px-4 py-3 mt-4">
              <p className="text-[10px] font-semibold text-body-grey uppercase tracking-widest mb-1">
                Working on
              </p>
              <p className="text-sm text-navy">{workingOn}</p>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/join?ref=${encodeURIComponent(handle)}`}
            className="w-full py-3.5 bg-lime text-navy font-semibold text-sm rounded-full text-center hover:bg-lime/90 transition-colors"
          >
            Request an invite
          </Link>
          <a
            href={`/api/qr/${encodeURIComponent(handle)}/vcard`}
            download
            className="w-full py-3.5 bg-navy text-warm-white font-semibold text-sm rounded-full text-center hover:bg-navy/90 transition-colors"
          >
            Save contact
          </a>
        </div>

        <p className="text-center text-xs text-body-grey mt-8 leading-relaxed">
          ROSTA is a professional network built around real introductions.
        </p>
      </div>
    </div>
  )
}
