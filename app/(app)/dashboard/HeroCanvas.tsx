'use client'

import { useEffect, useRef } from 'react'

interface Node {
  x: number; y: number
  vx: number; vy: number
  r: number
  isLime: boolean
  pulsePhase: number   // 0..2π, for per-node pulse offset
}

interface Conn {
  a: number; b: number
  drawT: number   // 0→1, how far the line has drawn
  alpha: number   // current rendered opacity
  alive: boolean  // still within range?
}

const LIME      = '#C8F53C'
const PALE      = '#F5F2EE'
const LINE_CLR  = '#C8F53C'
const COUNT     = 14
const SPEED     = 0.28   // px / frame at 60fps
const DIST_FRAC = 0.22   // max connection distance as fraction of min dimension
const DRAW_RATE = 0.014  // t increment per frame (~1.2s to draw at 60fps)
const FADE_IN   = 0.006
const FADE_OUT  = 0.012

export default function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Capture non-null refs for closure
    const cvs = canvas
    const gfx = ctx

    let raf: number
    let W = 0, H = 0
    let nodes: Node[] = []
    let conns: Conn[] = []
    let frame = 0

    function resize() {
      W = cvs.offsetWidth
      H = cvs.offsetHeight
      cvs.width  = W
      cvs.height = H
    }

    function init() {
      resize()
      nodes = Array.from({ length: COUNT }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * SPEED * 2,
        vy: (Math.random() - 0.5) * SPEED * 2,
        r: 2 + Math.random() * 2.5,
        isLime: Math.random() < 0.35,
        pulsePhase: Math.random() * Math.PI * 2,
      }))
      conns = []
    }

    function dist(a: Node, b: Node) {
      return Math.hypot(a.x - b.x, a.y - b.y)
    }

    function tick() {
      frame++
      gfx.clearRect(0, 0, W, H)

      const maxDist = Math.min(W, H) * DIST_FRAC

      // Move nodes, bounce softly at edges
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0)  { n.x = 0;  n.vx =  Math.abs(n.vx) }
        if (n.x > W)  { n.x = W;  n.vx = -Math.abs(n.vx) }
        if (n.y < 0)  { n.y = 0;  n.vy =  Math.abs(n.vy) }
        if (n.y > H)  { n.y = H;  n.vy = -Math.abs(n.vy) }
      }

      // Update connections
      const connMap = new Map<string, Conn>()
      for (const c of conns) connMap.set(`${c.a}-${c.b}`, c)

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = dist(nodes[i], nodes[j])
          const key = `${i}-${j}`
          if (d < maxDist) {
            if (!connMap.has(key)) {
              const c: Conn = { a: i, b: j, drawT: 0, alpha: 0, alive: true }
              conns.push(c)
              connMap.set(key, c)
            } else {
              const c = connMap.get(key)!
              c.alive = true
              c.drawT  = Math.min(1, c.drawT + DRAW_RATE)
              c.alpha  = Math.min(0.75, c.alpha + FADE_IN)
            }
          }
        }
      }

      // Mark dead connections
      for (const c of conns) if (!connMap.get(`${c.a}-${c.b}`)?.alive && !c.alive) {
        c.alpha = Math.max(0, c.alpha - FADE_OUT)
      }
      // Reset alive flag for next frame
      for (const c of conns) c.alive = false

      conns = conns.filter(c => c.alpha > 0)

      // Draw lines
      for (const c of conns) {
        const a = nodes[c.a]
        const b = nodes[c.b]
        // Endpoint tracks drawT — line animates from a toward b
        const ex = a.x + (b.x - a.x) * c.drawT
        const ey = a.y + (b.y - a.y) * c.drawT
        gfx.beginPath()
        gfx.moveTo(a.x, a.y)
        gfx.lineTo(ex, ey)
        gfx.strokeStyle = LINE_CLR
        gfx.globalAlpha = c.alpha * 0.18
        gfx.lineWidth = 0.7
        gfx.stroke()
      }

      // Draw nodes with per-node pulse
      for (const n of nodes) {
        const pulse = 0.7 + 0.3 * Math.sin(frame * 0.025 + n.pulsePhase)
        gfx.beginPath()
        gfx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        gfx.fillStyle = n.isLime ? LIME : PALE
        gfx.globalAlpha = 0.22 * pulse
        gfx.fill()
      }

      gfx.globalAlpha = 1
      raf = requestAnimationFrame(tick)
    }

    init()
    raf = requestAnimationFrame(tick)

    const onResize = () => init()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  )
}
