'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const APP_SCHEME      = 'rostanative://'
const TESTFLIGHT_URL  = 'https://testflight.apple.com/join/KtVFV4w8'

function getPlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua))          return 'android'
  return 'other'
}

export default function CheckInFallbackPage() {
  const [attempted, setAttempted] = useState(false)
  const [platform,  setPlatform]  = useState<'ios' | 'android' | 'other'>('other')

  useEffect(() => {
    setPlatform(getPlatform())
  }, [])

  // Attempt to open the native app automatically after a short delay.
  // If the app is installed, the OS will intercept the scheme and open it.
  // If not, the browser ignores it and the page stays visible.
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

          {/* QR / scan icon */}
          <div className="w-16 h-16 rounded-full bg-lime/15 flex items-center justify-center mx-auto mb-8">
            <svg
              className="w-7 h-7 text-lime"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
              <rect x="7" y="7" width="4" height="4" rx="0.5" strokeWidth={2} />
              <rect x="13" y="7" width="4" height="4" rx="0.5" strokeWidth={2} />
              <rect x="7" y="13" width="4" height="4" rx="0.5" strokeWidth={2} />
              <path strokeLinecap="round" d="M13 13h1v1h-1zM15 15h2v2h-2z" />
            </svg>
          </div>

          <h1 className="font-display text-4xl font-bold text-warm-white mb-4 leading-tight">
            You need the ROSTA app to check in.
          </h1>

          <p className="text-warm-white/65 text-base leading-relaxed mb-10">
            You scanned an event check-in code. To record your attendance, open or install ROSTA, then scan the code again.
          </p>

          {platform === 'ios' && (
            <>
              <button
                onClick={handleOpenApp}
                className="w-full py-4 bg-lime text-navy rounded-full font-semibold text-base hover:bg-lime/90 active:scale-[0.98] transition-all mb-4"
              >
                Open ROSTA
              </button>
              <Link
                href={TESTFLIGHT_URL}
                className="block w-full py-4 border border-warm-white/20 text-warm-white rounded-full font-semibold text-base hover:border-warm-white/40 transition-colors"
              >
                Download from TestFlight
              </Link>
              <p className="mt-6 text-warm-white/40 text-sm leading-relaxed">
                After installing, return here and scan the QR code again.
              </p>
            </>
          )}

          {platform === 'android' && (
            <>
              <button
                onClick={handleOpenApp}
                className="w-full py-4 bg-lime text-navy rounded-full font-semibold text-base hover:bg-lime/90 active:scale-[0.98] transition-all mb-4"
              >
                Open ROSTA
              </button>
              <p className="text-warm-white/50 text-sm leading-relaxed">
                ROSTA for Android is not available yet. Ask the event organiser to check you in manually.
              </p>
            </>
          )}

          {platform === 'other' && (
            <>
              <button
                onClick={handleOpenApp}
                className="w-full py-4 bg-lime text-navy rounded-full font-semibold text-base hover:bg-lime/90 active:scale-[0.98] transition-all mb-4"
              >
                Open ROSTA
              </button>
              <p className="text-warm-white/50 text-sm leading-relaxed">
                ROSTA is an iOS app. Scan this code from your phone.
              </p>
            </>
          )}

          {attempted && (
            <p className="mt-8 text-warm-white/30 text-xs leading-relaxed">
              If the app did not open, use the button above or install it first.
            </p>
          )}

        </div>
      </div>

    </div>
  )
}
