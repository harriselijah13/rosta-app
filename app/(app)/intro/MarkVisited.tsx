'use client'

import { useEffect } from 'react'
import { markIntroPageVisited } from './actions'

export default function MarkVisited() {
  useEffect(() => {
    markIntroPageVisited()
  }, [])
  return null
}
