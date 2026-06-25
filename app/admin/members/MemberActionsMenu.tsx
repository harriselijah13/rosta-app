'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AdminMember } from './MembersClient'

type Props = {
  member: AdminMember
  isVerified: boolean
  isLoading: boolean
  onFoundingToggle:     () => void
  onGrantVerification:  () => void
  onRemoveVerification: () => void
  onGenerateCode:       () => void
  onRemove:             () => void
}

type MenuPos = { top: number; left: number; openUp: boolean }

export default function MemberActionsMenu({
  member, isVerified, isLoading,
  onFoundingToggle, onGrantVerification, onRemoveVerification,
  onGenerateCode, onRemove,
}: Props) {
  const [isOpen,       setIsOpen]       = useState(false)
  const [menuPos,      setMenuPos]      = useState<MenuPos | null>(null)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const focusedIdxRef = useRef(-1)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef    = useRef<HTMLDivElement>(null)
  const itemRefs   = useRef<(HTMLButtonElement | null)[]>([])

  // ── Menu items ────────────────────────────────────────────────────────────
  type Item =
    | { kind: 'action'; label: string; danger?: boolean; onClick: () => void; disabled?: boolean }
    | { kind: 'divider' }

  const items: Item[] = [
    member.founding_member
      ? { kind: 'action', label: 'Revoke founding',      onClick: onFoundingToggle }
      : { kind: 'action', label: 'Grant founding',       onClick: onFoundingToggle },
    isVerified
      ? { kind: 'action', label: 'Remove verification',  onClick: () => { close(); setShowConfirm(true) } }
      : { kind: 'action', label: 'Grant verification',   onClick: () => { close(); onGrantVerification() } },
    { kind: 'divider' },
    { kind: 'action', label: 'Add invite code', onClick: () => { close(); onGenerateCode() } },
    { kind: 'divider' },
    { kind: 'action', label: 'Remove member', danger: true, onClick: () => { close(); onRemove() } },
  ]

  const actionItems = items.filter((i): i is Extract<Item, { kind: 'action' }> => i.kind === 'action')

  function close() {
    setIsOpen(false)
    focusedIdxRef.current = -1
  }

  // ── Open menu anchored to the trigger button ──────────────────────────────
  function handleOpen() {
    if (isLoading) return
    if (isOpen) { close(); return }

    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    const menuWidth = 208
    const estimatedMenuH = items.length * 36 + 16
    const viewportH = window.innerHeight
    const openUp = rect.bottom + estimatedMenuH > viewportH - 16

    setMenuPos({
      top:    openUp ? rect.top - estimatedMenuH - 4 : rect.bottom + 4,
      left:   Math.max(8, rect.right - menuWidth),
      openUp,
    })
    setIsOpen(true)
    focusedIdxRef.current = -1
  }

  // ── Click outside + ESC ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    function onMouse(e: MouseEvent) {
      if (
        menuRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return
      close()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { close(); triggerRef.current?.focus() }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = (focusedIdxRef.current + 1) % actionItems.length
        focusedIdxRef.current = next
        itemRefs.current[next]?.focus()
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = (focusedIdxRef.current - 1 + actionItems.length) % actionItems.length
        focusedIdxRef.current = prev
        itemRefs.current[prev]?.focus()
      }
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown',   onKey)
    }
  }, [isOpen, actionItems.length])

  // Focus first item when menu opens
  useEffect(() => {
    if (isOpen) {
      // Small delay so the menu has rendered
      const t = setTimeout(() => itemRefs.current[0]?.focus(), 10)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // ── ESC closes confirmation modal ─────────────────────────────────────────
  useEffect(() => {
    if (!showConfirm) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowConfirm(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showConfirm])

  // Build action item → itemRef index mapping
  const actionItemIndex = useCallback((item: Item): number => {
    if (item.kind === 'divider') return -1
    return actionItems.indexOf(item as Extract<Item, { kind: 'action' }>)
  }, [actionItems])

  const memberName = [member.first_name, member.last_name].filter(Boolean).join(' ') || 'this member'

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        ref={triggerRef}
        onClick={handleOpen}
        disabled={isLoading}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Actions for ${memberName}`}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40
          bg-navy/8 hover:bg-navy/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
      >
        <svg width="16" height="4" viewBox="0 0 16 4" fill="none" aria-hidden="true">
          <circle cx="2"  cy="2" r="1.5" fill="#0F1B3C" />
          <circle cx="8"  cy="2" r="1.5" fill="#0F1B3C" />
          <circle cx="14" cy="2" r="1.5" fill="#0F1B3C" />
        </svg>
      </button>

      {/* ── Dropdown menu (fixed-positioned to escape table overflow) ── */}
      {isOpen && menuPos && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Member actions"
          style={{ top: menuPos.top, left: menuPos.left, width: 208 }}
          className="fixed z-50 bg-white border border-border rounded-lg shadow-[0_8px_24px_rgba(15,27,60,0.12)] py-1"
        >
          {items.map((item, i) => {
            if (item.kind === 'divider') {
              return <div key={i} className="my-1 border-t border-border" />
            }
            const idx = actionItemIndex(item)
            return (
              <button
                key={item.label}
                ref={el => { itemRefs.current[idx] = el }}
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled || isLoading}
                onClick={item.onClick}
                className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors focus:outline-none
                  ${item.disabled || isLoading
                    ? 'opacity-40 cursor-not-allowed text-navy'
                    : item.danger
                    ? 'text-navy font-semibold hover:bg-surface'
                    : 'text-navy hover:bg-surface'
                  }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Remove verification confirmation modal ── */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowConfirm(false) }}
        >
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <h2 className="font-display text-2xl font-bold text-navy mb-3">
              Remove verification from {memberName}?
            </h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(15,27,60,0.70)' }}>
              They will lose their verified status and badge on their profile. This does not refund any payment — that is a separate action in Stripe if needed.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowConfirm(false); onRemoveVerification() }}
                className="w-full py-2.5 rounded-full text-sm font-semibold bg-navy text-warm-white hover:bg-navy/90 transition-colors"
              >
                Remove verification
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-sm font-medium transition-colors py-1"
                style={{ color: 'rgba(15,27,60,0.60)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
