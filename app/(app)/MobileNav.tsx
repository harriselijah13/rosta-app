'use client'

import { useState } from 'react'
import Link from 'next/link'

type Props = {
  profileSlug: string
  pendingIntros: number
  unreadMessages: number
}

export default function MobileNav({ profileSlug, pendingIntros, unreadMessages }: Props) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/dashboard"
          onClick={close}
          className="font-display text-xl font-bold text-navy"
        >
          ROSTA<span className="text-lime">.</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/members" className="text-sm text-body-grey hover:text-navy transition-colors">
            Members
          </Link>
          <Link href="/intro" className="relative text-sm text-body-grey hover:text-navy transition-colors">
            Intros
            {pendingIntros > 0 && (
              <span className="absolute -top-1.5 -right-3 w-4 h-4 rounded-full bg-lime text-navy text-[10px] font-bold flex items-center justify-center">
                {pendingIntros}
              </span>
            )}
          </Link>
          <Link href="/messages" className="relative text-sm text-body-grey hover:text-navy transition-colors">
            Messages
            {unreadMessages > 0 && (
              <span className="absolute -top-1.5 -right-3 w-4 h-4 rounded-full bg-lime text-navy text-[10px] font-bold flex items-center justify-center">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </Link>
          <Link href={`/profile/${profileSlug}`} className="text-sm text-body-grey hover:text-navy transition-colors">
            My profile
          </Link>
          <Link
            href="/settings"
            className="text-sm font-medium border border-navy text-navy px-4 py-1.5 rounded-full hover:bg-navy hover:text-warm-white transition-colors"
          >
            Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm text-body-grey hover:text-navy transition-colors">
              Sign out
            </button>
          </form>
        </div>

        {/* Mobile: hamburger + pending badge */}
        <button
          className="md:hidden relative p-1 text-navy"
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {pendingIntros > 0 && !open && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-lime text-navy text-[10px] font-bold flex items-center justify-center">
              {pendingIntros}
            </span>
          )}
          {open ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-border bg-white">
          <div className="px-6 py-5 flex flex-col gap-1">
            <Link
              href="/members"
              onClick={close}
              className="py-3 text-sm font-medium text-navy border-b border-border last:border-0"
            >
              Members
            </Link>
            <Link
              href="/intro"
              onClick={close}
              className="py-3 text-sm font-medium text-navy border-b border-border flex items-center justify-between"
            >
              Intros
              {pendingIntros > 0 && (
                <span className="w-5 h-5 rounded-full bg-lime text-navy text-[10px] font-bold flex items-center justify-center">
                  {pendingIntros}
                </span>
              )}
            </Link>
            <Link
              href="/messages"
              onClick={close}
              className="py-3 text-sm font-medium text-navy border-b border-border flex items-center justify-between"
            >
              Messages
              {unreadMessages > 0 && (
                <span className="w-5 h-5 rounded-full bg-lime text-navy text-[10px] font-bold flex items-center justify-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>
            <Link
              href={`/profile/${profileSlug}`}
              onClick={close}
              className="py-3 text-sm font-medium text-navy border-b border-border"
            >
              My profile
            </Link>
            <Link
              href="/settings"
              onClick={close}
              className="py-3 text-sm font-medium text-navy border-b border-border"
            >
              Settings
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="py-3 w-full text-left text-sm text-body-grey"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </nav>
  )
}
