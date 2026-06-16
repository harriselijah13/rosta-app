'use client'

import { useState } from 'react'

export default function OpenDoorToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving]   = useState(false)
  const [failed, setFailed]   = useState(false)

  async function toggle() {
    const next = !enabled
    setEnabled(next)
    setFailed(false)
    setSaving(true)
    try {
      const res = await fetch('/api/signals/open-door', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) {
        setEnabled(!next)
        setFailed(true)
      }
    } catch {
      setEnabled(!next)
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-6 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-lg font-bold text-navy">Open Door</h2>

            {/* Info tooltip */}
            <div className="relative group">
              <div className="w-4 h-4 rounded-full border border-body-grey/50 text-body-grey flex items-center justify-center cursor-default select-none text-[10px] font-semibold leading-none shrink-0">
                i
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 bg-navy text-warm-white text-xs rounded-xl px-3 py-2.5 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 shadow-lg">
                Open Door lets people in your network start a conversation without a warm intro. Warm intros still work either way.
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-navy" />
              </div>
            </div>
          </div>

          <p className="text-sm text-body-grey leading-relaxed">
            {enabled
              ? 'People can connect with you directly. Turn off any time.'
              : 'Only warm introductions. People need a mutual connection to reach you.'}
          </p>
          {failed && (
            <p className="text-xs text-red-500 mt-1.5">Couldn&apos;t save — try again.</p>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          disabled={saving}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/20 disabled:opacity-60 mt-0.5 ${
            enabled ? 'bg-lime' : 'bg-navy/30'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-warm-white shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
