'use client'

import Link from 'next/link'
import QRCode from 'react-qr-code'

export default function QRSection({ url }: { url: string }) {
  return (
    <section className="max-w-2xl mx-auto px-6 pb-10">
      <div className="bg-white border border-border rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold text-navy mb-1">Member QR code</h2>
        <p className="text-sm text-body-grey mb-6">
          Let another member scan this in person to connect instantly.
        </p>

        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="bg-surface border border-border rounded-xl p-4 shrink-0">
            <QRCode value={url} size={140} fgColor="#0F1B3C" bgColor="#F5F2EE" />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs text-body-grey font-mono break-all">{url}</p>
            <Link
              href="/qr"
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-navy text-warm-white px-4 py-2 rounded-full hover:bg-navy/90 transition-colors w-fit"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Full screen
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
