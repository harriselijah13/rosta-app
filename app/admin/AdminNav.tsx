'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { label: 'Overview',         href: '/admin/overview' },
  { label: 'Members',          href: '/admin/members' },
  { label: 'Verification',     href: '/admin/verification' },
  { label: 'Invite Codes',     href: '/admin/invite-codes' },
  { label: 'Invite Requests',  href: '/admin/invite-requests' },
  { label: 'Network Health',   href: '/admin/network-health' },
  { label: 'Geography',        href: '/admin/geography' },
  { label: 'Signups',          href: '/admin/signups' },
  { label: 'Online Now',       href: '/admin/online' },
  { label: 'Event Tools',      href: '/admin/event-tools' },
  { label: 'Email Tools',      href: '/admin/email-tools' },
  { label: 'System Health',    href: '/admin/system-health' },
]

export default function AdminNav({ pendingInviteRequestCount = 0 }: { pendingInviteRequestCount?: number }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const links = NAV.map(({ label, href }) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return { label, href, active }
  })

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-border bg-white min-h-screen sticky top-0">
        <div className="px-5 py-6 border-b border-border">
          <p className="font-display text-lg font-bold text-navy">
            ROSTA<span className="text-lime">.</span>
          </p>
          <p className="text-xs text-body-grey mt-0.5 tracking-widest uppercase">Admin</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {links.map(({ label, href, active }) => {
            const hasPendingDot =
              !active &&
              href === '/admin/invite-requests' &&
              pendingInviteRequestCount > 0
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-navy text-warm-white font-medium'
                    : 'text-body-grey hover:text-navy hover:bg-surface'
                }`}
              >
                {active && <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />}
                {label}
                {hasPendingDot && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                )}
              </Link>
            )
          })}
        </nav>
        <div className="px-5 py-4 border-t border-border">
          <Link href="/dashboard" className="text-xs text-body-grey hover:text-navy transition-colors">
            ← Back to app
          </Link>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <span className="font-display text-base font-bold text-navy">
            ROSTA<span className="text-lime">.</span>
          </span>
          <span className="ml-2 text-xs text-body-grey tracking-widest uppercase">Admin</span>
        </div>
        <button
          onClick={() => setOpen(v => !v)}
          className="p-1 text-navy"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      {/* ── Mobile dropdown ── */}
      {open && (
        <div className="md:hidden fixed inset-0 top-[53px] z-40 bg-white border-t border-border overflow-y-auto">
          <nav className="px-4 py-4 space-y-0.5">
            {links.map(({ label, href, active }) => {
              const hasPendingDot =
                !active &&
                href === '/admin/invite-requests' &&
                pendingInviteRequestCount > 0
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-3 py-3 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-navy text-warm-white font-medium'
                      : 'text-body-grey hover:text-navy hover:bg-surface'
                  }`}
                >
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />}
                  {label}
                  {hasPendingDot && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                  )}
                </Link>
              )
            })}
            <div className="pt-4 border-t border-border mt-4">
              <Link href="/dashboard" className="text-xs text-body-grey" onClick={() => setOpen(false)}>
                ← Back to app
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
