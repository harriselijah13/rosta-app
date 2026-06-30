'use client'

import Link from 'next/link'
import type { FeedSignalUpdate } from './feedUtils'

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 2)   return 'Just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />
  }
  return (
    <span className="w-8 h-8 rounded-full bg-navy/10 text-navy text-xs font-semibold flex items-center justify-center shrink-0">
      {initials}
    </span>
  )
}

const SIGNAL_LABELS: Record<string, string> = {
  open_to:        'Open To',
  working_on:     'Working On',
  need_right_now: 'Need Right Now',
}

type ReactionType = 'can_help' | 'know_someone' | 'noted'

function ReactionButton({
  label, icon, active, disabled, onClick,
}: {
  label: string
  icon: React.ReactNode
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40
        ${active
          ? 'bg-navy text-warm-white'
          : 'text-body-grey hover:text-navy hover:bg-white'
        }`}
    >
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      <span className="text-[11px] font-medium leading-none whitespace-nowrap">{label}</span>
    </button>
  )
}

const HandIcon   = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8l3 3h8" />
  </svg>
)
const PersonIcon = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
)

type Props = {
  update: FeedSignalUpdate
  onReact: (type: ReactionType, action: 'add' | 'remove') => Promise<void>
  reacting: boolean
}

export default function SignalUpdateCard({ update, onReact, reacting }: Props) {
  const profileHref = update.memberUsername
    ? `/profile/${update.memberUsername}`
    : `/profile/${update.memberId}`

  const reachOutHref = update.conversationId
    ? `/messages/${update.conversationId}`
    : `/api/conversations/with/${update.memberId}`

  function handleReact(type: ReactionType) {
    const alreadyReacted = update.myReactions.includes(type)
    onReact(type, alreadyReacted ? 'remove' : 'add')
  }

  return (
    <article className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <Link href={profileHref} className="shrink-0">
          <Avatar name={update.memberName} avatarUrl={update.memberAvatarUrl} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={profileHref} className="text-sm font-medium text-navy hover:underline">
              {update.memberName}
            </Link>
            {update.memberIsVerified && (
              <span className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full bg-lime shrink-0">
                <svg viewBox="0 0 20 20" fill="none" className="w-2.5 h-2.5">
                  <path d="M5 10.5l3 3 7-7" stroke="#0F1B3C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
            <span className="text-xs text-body-grey">
              updated {SIGNAL_LABELS[update.signalType] ?? update.signalType}
            </span>
            <span className="text-xs text-body-grey ml-auto shrink-0">{relativeTime(update.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Signal value */}
      <p className="text-base font-medium text-navy leading-snug">{update.newValue}</p>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border/60 pt-3 -mb-1">
        <div className="flex items-center gap-1">
          <ReactionButton
            label="I can help"
            icon={<HandIcon filled={update.myReactions.includes('can_help')} />}
            active={update.myReactions.includes('can_help')}
            disabled={reacting}
            onClick={() => handleReact('can_help')}
          />
          <ReactionButton
            label="I know someone"
            icon={<PersonIcon filled={update.myReactions.includes('know_someone')} />}
            active={update.myReactions.includes('know_someone')}
            disabled={reacting}
            onClick={() => handleReact('know_someone')}
          />
          <ReactionButton
            label="Noted"
            icon={<BookmarkIcon filled={update.myReactions.includes('noted')} />}
            active={update.myReactions.includes('noted')}
            disabled={reacting}
            onClick={() => handleReact('noted')}
          />
        </div>
        <Link
          href={reachOutHref}
          className="text-xs font-medium border border-navy text-navy px-3 py-1.5 rounded-full hover:bg-navy hover:text-warm-white transition-colors shrink-0"
        >
          Reach out
        </Link>
      </div>
    </article>
  )
}
