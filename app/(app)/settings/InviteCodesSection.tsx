'use client'

import { useState } from 'react'

type InviteCode = {
  id: string
  token: string
  used_at: string | null
  usedByName: string | null
}

export default function InviteCodesSection({ codes }: { codes: InviteCode[] }) {
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(token: string) {
    await navigator.clipboard.writeText(token)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <section className="bg-white border border-border rounded-2xl p-6 mb-4">
      <div className="mb-5">
        <h2 className="font-display text-xl font-bold text-navy mb-1">Your invite codes</h2>
        <p className="text-sm text-body-grey">
          Share these with people you want to bring into ROSTA. When they sign up you earn +1 Connector Score.
        </p>
      </div>
      <div className="space-y-2">
        {codes.map(code => (
          <div
            key={code.id}
            className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border ${
              code.used_at ? 'border-border bg-surface' : 'border-border bg-white'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`font-mono text-sm font-semibold tracking-widest ${
                  code.used_at ? 'text-body-grey line-through' : 'text-navy'
                }`}
              >
                {code.token}
              </span>
              {code.used_at && (
                <span className="text-xs text-body-grey truncate">
                  Used{code.usedByName ? ` by ${code.usedByName}` : ''}
                </span>
              )}
            </div>
            {!code.used_at && (
              <button
                onClick={() => copy(code.token)}
                className="shrink-0 text-xs font-medium text-navy border border-border px-3 py-1.5 rounded-full hover:border-navy transition-colors"
              >
                {copied === code.token ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
