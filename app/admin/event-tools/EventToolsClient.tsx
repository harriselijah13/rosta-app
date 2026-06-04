'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createEventQR, revokeEventCode } from './actions'

export type GuestCode = {
  id: string
  token: string
  owner_name: string
  label: string | null
  created_at: string
  expires_at: string
  is_expired: boolean
  connections: {
    id: string
    guest_name: string
    guest_email: string
    guest_what_i_do: string
    created_at: string
  }[]
}

const BASE = 'https://app.onrosta.com'

function qrUrl(token: string) {
  return `${BASE}/connect/${token}`
}

function relDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function EventToolsClient({ codes }: { codes: GuestCode[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [label, setLabel]           = useState('')
  const [expiryDays, setExpiryDays] = useState(30)
  const [creating, setCreating]     = useState(false)
  const [newCode, setNewCode]       = useState<string | null>(null)
  const [copied, setCopied]         = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setNewCode(null)
    const { token } = await createEventQR(label, expiryDays)
    setNewCode(token)
    setLabel('')
    setExpiryDays(30)
    setCreating(false)
    router.refresh()
  }

  function handleRevoke(code: GuestCode) {
    if (!confirm(`Revoke code "${code.label ?? code.token}"? All ${code.connections.length} guest connection records will remain but the link will stop working.`)) return
    startTransition(async () => {
      await revokeEventCode(code.id)
      router.refresh()
    })
  }

  function copyUrl(token: string) {
    navigator.clipboard.writeText(qrUrl(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold text-navy">Event Tools</h1>

      {/* Generate */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">Generate a guest QR code</h2>
        <div className="bg-white border border-border rounded-2xl p-5">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-body-grey mb-1.5">Event name</label>
              <input
                type="text"
                placeholder="e.g. RAK Founders Dinner"
                value={label}
                onChange={e => setLabel(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-body-grey mb-1.5">Expires in</label>
              <select
                value={expiryDays}
                onChange={e => setExpiryDays(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={creating || !label.trim()}
              className="px-5 py-2.5 bg-navy text-warm-white text-sm font-medium rounded-full hover:bg-navy/90 transition-colors disabled:opacity-40"
            >
              {creating ? 'Generating...' : 'Generate'}
            </button>
          </form>

          {newCode && (
            <div className="mt-4 p-4 bg-surface border border-border rounded-xl">
              <p className="text-xs font-medium text-body-grey mb-2">New QR code created</p>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="text-sm font-mono text-navy bg-white border border-border px-3 py-1.5 rounded-lg flex-1 min-w-0 truncate">
                  {qrUrl(newCode)}
                </code>
                <button
                  onClick={() => copyUrl(newCode)}
                  className="text-xs font-medium border border-border px-3 py-1.5 rounded-full hover:border-navy transition-colors shrink-0"
                >
                  {copied === newCode ? 'Copied' : 'Copy URL'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Codes list */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">
          All guest QR codes
          <span className="ml-2 text-base font-sans font-normal text-body-grey">({codes.length})</span>
        </h2>

        {codes.length === 0 ? (
          <div className="bg-white border border-border rounded-2xl px-6 py-10 text-center">
            <p className="text-sm text-body-grey">No guest QR codes generated yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {codes.map(code => (
              <div key={code.id} className="bg-white border border-border rounded-2xl overflow-hidden">
                {/* Code row */}
                <div className="px-5 py-4 flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-medium text-navy">
                        {code.label ?? 'Unnamed event'}
                      </p>
                      {code.is_expired ? (
                        <span className="text-[10px] font-medium text-body-grey border border-border px-1.5 py-0.5 rounded-full">Expired</span>
                      ) : (
                        <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-green-500 shrink-0" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-body-grey">
                      By {code.owner_name} · Created {relDate(code.created_at)} · Expires {relDate(code.expires_at)}
                    </p>
                    <p className="text-xs text-body-grey mt-0.5 font-mono truncate">{qrUrl(code.token)}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyUrl(code.token)}
                      className="text-xs border border-border px-3 py-1.5 rounded-full hover:border-navy transition-colors"
                    >
                      {copied === code.token ? 'Copied' : 'Copy URL'}
                    </button>
                    <button
                      onClick={() => setExpanded(expanded === code.id ? null : code.id)}
                      className="text-xs font-medium text-body-grey hover:text-navy transition-colors"
                    >
                      {code.connections.length} connection{code.connections.length !== 1 ? 's' : ''}
                      {' '}{expanded === code.id ? '▲' : '▼'}
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => handleRevoke(code)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                    >
                      Revoke
                    </button>
                  </div>
                </div>

                {/* Connections expansion */}
                {expanded === code.id && (
                  <div className="border-t border-border bg-surface/50">
                    {code.connections.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-body-grey">No guest connections from this code yet.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="px-5 py-2.5 text-left text-xs font-medium text-body-grey uppercase tracking-wide">Name</th>
                            <th className="px-5 py-2.5 text-left text-xs font-medium text-body-grey uppercase tracking-wide">Email</th>
                            <th className="px-5 py-2.5 text-left text-xs font-medium text-body-grey uppercase tracking-wide hidden sm:table-cell">What they do</th>
                            <th className="px-5 py-2.5 text-left text-xs font-medium text-body-grey uppercase tracking-wide">Connected</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {code.connections.map(gc => (
                            <tr key={gc.id}>
                              <td className="px-5 py-3 font-medium text-navy whitespace-nowrap">{gc.guest_name}</td>
                              <td className="px-5 py-3 text-body-grey">{gc.guest_email}</td>
                              <td className="px-5 py-3 text-body-grey hidden sm:table-cell max-w-[200px] truncate">{gc.guest_what_i_do}</td>
                              <td className="px-5 py-3 text-body-grey whitespace-nowrap">{relDate(gc.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
