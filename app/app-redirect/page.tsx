'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Deep-link scheme for the ROSTA iOS app (defined in app.json → expo.scheme)
const APP_SCHEME = 'rostanative://'

// TestFlight link — the only way to install the app until it's publicly listed on the App Store.
// Once ROSTA is live on the App Store, replace this with the App Store URL:
// https://apps.apple.com/app/id<YOUR_APP_ID>
const APP_STORE_URL = 'https://testflight.apple.com/join/KtVFV4w8'

export default function AppRedirectPage() {
  const [attempted, setAttempted] = useState(false)

  // Attempt to open the native app automatically after a short delay.
  // The delay lets the page render visibly before the browser tries the scheme.
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = APP_SCHEME
      setAttempted(true)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  function handleOpenApp() {
    window.location.href = APP_SCHEME
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col relative overflow-hidden">

      {/* Ambient dots */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none">
        <div className="absolute top-[10%]  left-[8%]   w-1.5 h-1.5 rounded-full bg-white/[0.06]" />
        <div className="absolute top-[22%]  right-[14%] w-1   h-1   rounded-full bg-white/[0.05]" />
        <div className="absolute top-[45%]  left-[6%]   w-1   h-1   rounded-full bg-white/[0.07]" />
        <div className="absolute top-[60%]  right-[8%]  w-1.5 h-1.5 rounded-full bg-white/[0.05]" />
        <div className="absolute bottom-[25%] left-[55%] w-1 h-1   rounded-full bg-white/[0.06]" />
        <div className="absolute bottom-[15%] right-[12%] w-1.5 h-1.5 rounded-full bg-white/[0.05]" />
      </div>

      {/* Nav */}
      <nav className="px-8 py-5 relative z-10">
        <span className="font-display text-2xl font-bold text-warm-white">
          ROSTA<span className="text-lime">.</span>
        </span>
      </nav>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center relative z-10">
        <div className="w-full max-w-sm">

          {/* Check mark */}
          <div className="w-16 h-16 rounded-full bg-lime/15 flex items-center justify-center mx-auto mb-8">
            <svg
              className="w-7 h-7 text-lime"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="font-display text-4xl font-bold text-warm-white mb-4 leading-tight">
            You&apos;re all set.
          </h1>

          <p className="text-warm-white/65 text-base leading-relaxed mb-10">
            Your profile is live. Open the ROSTA app to connect with your network.
          </p>

          {/* Primary: open app */}
          <button
            onClick={handleOpenApp}
            className="w-full py-4 bg-lime text-navy rounded-full font-semibold text-base hover:bg-lime/90 active:scale-[0.98] transition-all"
          >
            Open ROSTA
          </button>

          {/* Secondary: App Store fallback */}
          <p className="mt-6 text-warm-white/45 text-sm">
            Don&apos;t have the app?{' '}
            <Link
              href={APP_STORE_URL}
              className="text-warm-white/70 font-medium hover:text-warm-white underline underline-offset-2 transition-colors"
            >
              Download it
            </Link>
          </p>

          {/* Subtle hint shown after auto-attempt */}
          {attempted && (
            <p className="mt-8 text-warm-white/30 text-xs leading-relaxed">
              If the app didn&apos;t open, tap the button above or download it from the App Store.
            </p>
          )}

        </div>
      </div>

    </div>
  )
}
