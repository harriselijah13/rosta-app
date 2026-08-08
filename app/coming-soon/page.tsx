import Link from 'next/link'

export const metadata = {
  title: 'ROSTA — Coming Soon',
}

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-warm-white flex flex-col">
      <nav className="px-8 py-5">
        <Link href="/" className="font-display text-2xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full">
          <h1 className="font-display text-5xl font-bold text-navy mb-5 leading-tight">
            You&apos;re in.
          </h1>
          <p className="text-body-grey text-base leading-relaxed mb-12">
            ROSTA lives on your phone. The app&apos;s almost ready — we&apos;ll let you know
            the moment it&apos;s live, with a link straight to download.
          </p>

          {/* ── App Store badge + QR placeholder ──────────────────────────
              Replace the two boxes below with:
              1. A real <a href="..."><img src="app-store-badge.svg" /></a>
              2. A <img src="qr-code.png" /> pointing to the App Store link
          ─────────────────────────────────────────────────────────────── */}
          <div className="border-2 border-dashed border-border rounded-2xl p-7">
            <p className="text-xs font-medium uppercase tracking-wider text-body-grey/50 mb-5 text-center">
              Coming soon — download links
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {/* App Store badge placeholder */}
              <div className="w-40 h-14 rounded-xl border border-border bg-surface flex flex-col items-center justify-center gap-1">
                <svg className="w-5 h-5 text-body-grey/30" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <span className="text-xs text-body-grey/40 font-medium">App Store</span>
              </div>

              {/* QR code placeholder */}
              <div className="w-24 h-24 rounded-xl border border-border bg-surface flex items-center justify-center">
                <div className="text-center">
                  <div className="grid grid-cols-3 gap-0.5 mb-1 mx-auto w-fit opacity-20">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-sm ${[0,2,6,8,4].includes(i) ? 'bg-navy' : 'bg-transparent'}`} />
                    ))}
                  </div>
                  <span className="text-[9px] text-body-grey/40 font-medium leading-none">QR code</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
