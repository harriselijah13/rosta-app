'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import BadgeIcon from './BadgeIcon'
import type { BadgeDef } from '@/lib/badge-catalog'

interface Props {
  badges: BadgeDef[]   // unshown badges, most recent first
  profileSlug: string
}

export default function BadgeEarnedModal({ badges, profileSlug }: Props) {
  const [index, setIndex]     = useState(0)
  const [visible, setVisible] = useState(false)
  const [fading, setFading]   = useState(false)
  const [gone, setGone]       = useState(false)

  const badge = badges[index]

  // Fade in on first render
  useEffect(() => {
    if (badges.length === 0) return
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [badges.length])

  const markShown = useCallback(async (slug: string) => {
    await fetch('/api/badges/mark-shown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    }).catch(() => {})
  }, [])

  const dismiss = useCallback(() => {
    if (fading) return
    setFading(true)
    setVisible(false)
    setTimeout(async () => {
      await markShown(badge.slug)
      const next = index + 1
      if (next < badges.length) {
        setIndex(next)
        setFading(false)
        // tiny delay so the new badge fades in cleanly
        setTimeout(() => setVisible(true), 30)
      } else {
        setGone(true)
      }
    }, 220)
  }, [fading, badge?.slug, index, badges.length, markShown])

  // Esc key dismissal
  useEffect(() => {
    if (gone || badges.length === 0) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismiss, gone, badges.length])

  if (gone || badges.length === 0 || !badge) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: `rgba(15,27,60,${visible ? 0.6 : 0})`,
        transition: 'background-color 0.22s ease-out',
      }}
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-modal-name"
        onClick={e => e.stopPropagation()}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          transition: 'opacity 0.22s ease-out, transform 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-[480px] px-8 py-10 flex flex-col items-center text-center"
      >
        {/* Badge visual */}
        <div className="mb-6">
          <BadgeIcon slug={badge.slug} earned size={120} />
        </div>

        {/* Badge name */}
        <h2
          id="badge-modal-name"
          className="font-display text-2xl font-black text-navy leading-tight mb-1"
        >
          {badge.label}
        </h2>

        {/* Sub-headline */}
        <p className="font-display text-base font-medium italic text-navy mb-4">
          You&apos;ve been recognised.
        </p>

        {/* Description */}
        <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgba(15,27,60,0.65)' }}>
          {badge.earnDescription}
        </p>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 w-full">
          <button
            onClick={dismiss}
            className="w-full py-3 bg-lime text-navy font-semibold text-sm rounded-full hover:bg-lime/90 transition-colors"
          >
            Got it
          </button>
          <Link
            href={`/profile/${profileSlug}#badges`}
            onClick={dismiss}
            className="text-xs text-body-grey hover:text-navy transition-colors"
          >
            View your badges
          </Link>
        </div>

        {/* Queue indicator — only when multiple badges pending */}
        {badges.length > 1 && (
          <p className="text-[10px] text-body-grey mt-5">
            {index + 1} of {badges.length}
          </p>
        )}
      </div>
    </div>
  )
}
