'use client'

import { useEffect, useState } from 'react'

export default function AvatarLightbox({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null
  name: string
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  function open() {
    setMounted(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }

  function close() {
    setVisible(false)
    setTimeout(() => setMounted(false), 200)
  }

  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mounted])

  const initials =
    name.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <>
      <div className="shrink-0">
        {avatarUrl ? (
          <button
            onClick={open}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-navy"
            aria-label="View profile photo"
          >
            <img
              src={avatarUrl}
              alt={name}
              className="w-20 h-20 rounded-full object-cover hover:opacity-90 transition-opacity cursor-zoom-in"
            />
          </button>
        ) : (
          <div className="w-20 h-20 rounded-full bg-navy/10 text-navy text-xl font-semibold flex items-center justify-center">
            {initials}
          </div>
        )}
      </div>

      {mounted && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 transition-opacity duration-200"
          style={{ opacity: visible ? 1 : 0 }}
          onClick={close}
        >
          <button
            onClick={e => { e.stopPropagation(); close() }}
            className="absolute top-4 right-5 text-white/70 hover:text-white text-4xl leading-none transition-colors"
            aria-label="Close"
          >
            ×
          </button>
          <img
            src={avatarUrl!}
            alt={name}
            onClick={e => e.stopPropagation()}
            className="rounded-full object-cover shadow-2xl"
            style={{
              width: 'min(400px, 85vw)',
              height: 'min(400px, 85vw)',
            }}
          />
        </div>
      )}
    </>
  )
}
