'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  connectionId: string
  otherName: string
  pendingIntroCount: number
}

export default function RemoveConnectionLink({
  connectionId,
  otherName,
  pendingIntroCount,
}: Props) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast,   setToast]   = useState(false)
  const router = useRouter()

  async function handleRemove() {
    setLoading(true)
    const res = await fetch(`/api/connections/${connectionId}/remove`, { method: 'POST' })
    if (!res.ok) {
      setLoading(false)
      setOpen(false)
      return
    }
    setOpen(false)
    setToast(true)
    setTimeout(() => {
      router.push('/members')
    }, 1800)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-body-grey/50 hover:text-body-grey transition-colors"
      >
        Remove from network
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(15,27,60,0.6)' }}
          onClick={() => !loading && setOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8"
          >
            <h2 className="font-display text-lg font-semibold text-navy mb-3">
              Remove {otherName} from your network?
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(15,27,60,0.65)' }}>
              You won&apos;t be connected anymore. Your previous messages will stay visible
              but you won&apos;t be able to send new ones.
            </p>

            {pendingIntroCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm text-amber-700">
                  This will also cancel {pendingIntroCount} pending{' '}
                  {pendingIntroCount === 1 ? 'introduction' : 'introductions'} involving{' '}
                  {otherName}.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={handleRemove}
                disabled={loading}
                className="w-full py-3 bg-navy text-warm-white font-semibold text-sm rounded-full hover:bg-navy/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Removing…' : 'Remove'}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="text-sm text-body-grey hover:text-navy transition-colors py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-navy text-warm-white text-sm font-medium px-5 py-3 rounded-full shadow-lg whitespace-nowrap pointer-events-none">
          Removed from your network.
        </div>
      )}
    </>
  )
}
