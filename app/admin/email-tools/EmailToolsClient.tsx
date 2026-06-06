'use client'

import { useState } from 'react'
import { sendAdminEmail, getPreviewHtml } from './actions'

export type SendLog = {
  id: string
  sent_at: string
  scope: string
  subject: string
  recipient_count: number
  recipient_email: string | null
  sent_by_name: string
}

export type ScopeCounts = {
  all: number
  founding: number
  inactive: number
}

type Scope = 'all' | 'founding' | 'inactive' | 'specific'

const SCOPE_LABELS: Record<Scope, string> = {
  all:      'All members',
  founding: 'Founding members only',
  inactive: 'Inactive (14+ days)',
  specific: 'Specific member by email',
}

const WAITLIST_INVITE_BODY = `Hi [Name],

I wanted to personally invite you to join ROSTA — the professional network I've been building.

You're exactly the kind of person I had in mind when I built this. No feed, no follower counts, no performing. Just warm introductions and real connections.

You're joining a founding community of exceptional people.

Sign up here: https://app.onrosta.com/signup
Use invite code: [INVITE CODE]

Looking forward to having you in the network.

Harris
Founder, ROSTA`

const TEMPLATES = [
  { value: '',          label: 'Use a template…' },
  { value: 'waitlist',  label: 'Waitlist Invitation' },
]

const PLACEHOLDER_RE = /\[(Name|INVITE CODE)\]/g

function detectPlaceholders(text: string): string[] {
  const results: string[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(PLACEHOLDER_RE.source, 'g')
  while ((m = re.exec(text)) !== null) results.push(m[0])
  return results
}

function scopeCount(scope: Scope, counts: ScopeCounts, specificEmail: string): string {
  if (scope === 'specific') return specificEmail.trim() ? '1 recipient' : 'Enter an email'
  const n = counts[scope]
  return `${n} recipient${n !== 1 ? 's' : ''}`
}

export default function EmailToolsClient({
  counts,
  log,
}: {
  counts: ScopeCounts
  log: SendLog[]
}) {
  const [scope, setScope]                 = useState<Scope>('all')
  const [specificEmail, setSpecificEmail] = useState('')
  const [subject, setSubject]             = useState('')
  const [body, setBody]                   = useState('')
  const [previewing, setPreviewing]       = useState(false)
  const [previewHtml, setPreviewHtml]     = useState('')
  const [sending, setSending]             = useState(false)
  const [result, setResult]               = useState<{ sent: number; errors: number } | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState('')

  const remainingPlaceholders = body.trim() ? detectPlaceholders(body) : []
  const hasPlaceholders       = remainingPlaceholders.length > 0
  const canSend               = subject.trim() && body.trim() && (scope !== 'specific' || specificEmail.trim())

  function applyTemplate(value: string) {
    setSelectedTemplate(value)
    if (value === 'waitlist') {
      setScope('specific')
      setSubject("You're invited to ROSTA.")
      setBody(WAITLIST_INVITE_BODY)
      setSpecificEmail('')
      setPreviewing(false)
      setResult(null)
    }
  }

  async function handlePreview() {
    if (!subject.trim() || !body.trim()) return
    setPreviewing(true)
    const html = await getPreviewHtml(subject, body)
    setPreviewHtml(html)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend) return

    const recipientLabel = scope === 'specific' ? specificEmail : SCOPE_LABELS[scope].toLowerCase()
    let confirmMsg = `Send "${subject}" to ${recipientLabel}?`
    if (hasPlaceholders) {
      confirmMsg += `\n\nWarning: message still contains unreplaced placeholders: ${remainingPlaceholders.join(', ')}. Send anyway?`
    }
    if (!confirm(confirmMsg)) return

    setSending(true)
    setResult(null)
    const res = await sendAdminEmail(scope, specificEmail, subject, body)
    setResult(res)
    setSending(false)
    if (res.sent > 0) {
      setSubject('')
      setBody('')
      setSpecificEmail('')
      setSelectedTemplate('')
      setPreviewing(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold text-navy">Email Tools</h1>

      {/* Compose */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">Compose</h2>
        <form onSubmit={handleSend} className="bg-white border border-border rounded-2xl p-5 space-y-4">

          {/* Template selector */}
          <div>
            <label className="block text-xs font-medium text-body-grey mb-1.5">Template</label>
            <select
              value={selectedTemplate}
              onChange={e => applyTemplate(e.target.value)}
              className="w-full max-w-xs px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
            >
              {TEMPLATES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {selectedTemplate === 'waitlist' && (
              <p className="text-xs text-body-grey mt-1.5">
                Replace <span className="font-mono font-medium text-navy">[Name]</span> and <span className="font-mono font-medium text-navy">[INVITE CODE]</span> before sending.
              </p>
            )}
          </div>

          <hr className="border-border" />

          {/* Scope */}
          <div>
            <label className="block text-xs font-medium text-body-grey mb-2">Send to</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['all', 'founding', 'inactive', 'specific'] as Scope[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${
                    scope === s
                      ? 'border-navy bg-navy text-warm-white'
                      : 'border-border text-navy hover:border-navy'
                  }`}
                >
                  <span className="block font-medium text-xs">{SCOPE_LABELS[s]}</span>
                  <span className={`text-xs mt-0.5 block ${scope === s ? 'text-warm-white/70' : 'text-body-grey'}`}>
                    {scopeCount(s, counts, specificEmail)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Specific email */}
          {scope === 'specific' && (
            <div>
              <label className="block text-xs font-medium text-body-grey mb-1.5">Recipient email</label>
              <input
                type="email"
                placeholder="member@example.com"
                value={specificEmail}
                onChange={e => setSpecificEmail(e.target.value)}
                required
                className="w-full max-w-sm px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
              />
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-body-grey mb-1.5">
              Subject <span className="font-normal text-body-grey">(prefixed with [ROSTA])</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="An update from the team"
              required
              className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-body-grey mb-1.5">Message body</label>
            <textarea
              value={body}
              onChange={e => { setBody(e.target.value); setPreviewing(false) }}
              placeholder="Write your message here. Line breaks are preserved."
              required
              rows={10}
              className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors resize-y font-mono"
            />
          </div>

          {/* Placeholder warning */}
          {hasPlaceholders && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">Replace before sending</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Still contains:{' '}
                  {remainingPlaceholders.map((p, i) => (
                    <span key={i}>
                      <span className="font-mono font-semibold">{p}</span>
                      {i < remainingPlaceholders.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <button
              type="submit"
              disabled={!canSend || sending}
              className="px-6 py-2.5 bg-navy text-warm-white text-sm font-medium rounded-full hover:bg-navy/90 transition-colors disabled:opacity-40"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
            <button
              type="button"
              disabled={!subject.trim() || !body.trim()}
              onClick={handlePreview}
              className="px-5 py-2.5 border border-border text-navy text-sm font-medium rounded-full hover:border-navy transition-colors disabled:opacity-40"
            >
              {previewing ? 'Update preview' : 'Preview'}
            </button>
            {previewing && (
              <button type="button" onClick={() => setPreviewing(false)} className="text-xs text-body-grey hover:text-navy transition-colors">
                Close preview
              </button>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className={`text-sm px-4 py-3 rounded-xl ${result.errors > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
              {result.sent > 0 && <span>{result.sent} email{result.sent !== 1 ? 's' : ''} sent successfully. </span>}
              {result.errors > 0 && <span>{result.errors} failed to send.</span>}
              {result.sent === 0 && result.errors === 0 && <span>No recipients found for this scope.</span>}
            </div>
          )}
        </form>

        {/* Preview pane */}
        {previewing && previewHtml && (
          <div className="mt-4">
            <p className="text-xs font-medium text-body-grey mb-2 uppercase tracking-widest">Email preview</p>
            <div className="border border-border rounded-2xl overflow-hidden bg-warm-white">
              <iframe
                srcDoc={previewHtml}
                className="w-full"
                style={{ height: 520, border: 'none' }}
                title="Email preview"
              />
            </div>
          </div>
        )}
      </section>

      {/* Send log */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">Send log</h2>
        {log.length === 0 ? (
          <div className="bg-white border border-border rounded-2xl px-5 py-8 text-center">
            <p className="text-sm text-body-grey">No admin emails sent yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    {['Sent', 'By', 'Scope', 'Subject', 'Recipients'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-body-grey uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {log.map(entry => (
                    <tr key={entry.id} className="hover:bg-surface/50">
                      <td className="px-4 py-3 text-body-grey whitespace-nowrap text-xs">
                        {new Date(entry.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' '}
                        {new Date(entry.sent_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-navy whitespace-nowrap">{entry.sent_by_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium bg-surface border border-border text-body-grey px-2 py-0.5 rounded-full">
                          {SCOPE_LABELS[entry.scope as Scope] ?? entry.scope}
                          {entry.recipient_email && `: ${entry.recipient_email}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-navy max-w-[240px] truncate">{entry.subject}</td>
                      <td className="px-4 py-3 text-body-grey text-right">{entry.recipient_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
