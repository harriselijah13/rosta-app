'use client'

import { useEffect } from 'react'

export default function TrackMembersVisit({ alreadyTracked }: { alreadyTracked: boolean }) {
  useEffect(() => {
    if (!alreadyTracked) {
      fetch('/api/profile/first-visit-members', { method: 'POST' }).catch(() => {})
    }
  }, [alreadyTracked])
  return null
}
