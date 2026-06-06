'use client'

// Positions in viewport-percent space (matches SVG viewBox 0-100)
const NODES = [
  { x: 8,  y: 10, size: 5, duration: 5.2, delay: 0    },
  { x: 26, y: 5,  size: 4, duration: 6.0, delay: 1.3  },
  { x: 62, y: 13, size: 6, duration: 4.6, delay: 0.7  },
  { x: 84, y: 7,  size: 4, duration: 5.5, delay: 2.2  },
  { x: 91, y: 36, size: 5, duration: 4.2, delay: 0.4  },
  { x: 77, y: 58, size: 4, duration: 6.1, delay: 1.8  },
  { x: 13, y: 50, size: 5, duration: 5.0, delay: 2.6  },
  { x: 45, y: 73, size: 4, duration: 4.8, delay: 1.0  },
  { x: 69, y: 83, size: 6, duration: 5.4, delay: 2.9  },
  { x: 5,  y: 80, size: 4, duration: 4.3, delay: 1.5  },
]

// Pairs of node indices to connect with lines
const LINES: [number, number, number, number][] = [
  [0, 1, 5.8, 0.2],
  [1, 2, 6.3, 0.9],
  [2, 4, 5.1, 0.0],
  [3, 4, 4.9, 1.6],
  [4, 5, 5.7, 0.5],
  [6, 7, 6.0, 2.0],
  [7, 8, 4.7, 1.1],
  [0, 6, 5.5, 0.7],
]

export default function NetworkBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -1 }}>

      {/* SVG connection lines */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {LINES.map(([a, b, dur, delay], i) => (
          <line
            key={i}
            x1={NODES[a].x} y1={NODES[a].y}
            x2={NODES[b].x} y2={NODES[b].y}
            stroke="#C8F53C"
            strokeWidth="0.12"
            className="network-line"
            style={{
              '--line-duration': `${dur}s`,
              '--line-delay': `${delay}s`,
            } as React.CSSProperties}
          />
        ))}
      </svg>

      {/* Floating lime nodes */}
      {NODES.map((node, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="absolute rounded-full bg-lime network-node"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            width: node.size,
            height: node.size,
            '--node-duration': `${node.duration}s`,
            '--node-delay': `${node.delay}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Large orbit rings — top right, partially off-screen */}
      <div
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          width: 640,
          height: 640,
          top: -220,
          right: -220,
          border: '1px solid rgba(15,27,60,0.08)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          width: 420,
          height: 420,
          top: -110,
          right: -110,
          border: '1px solid rgba(15,27,60,0.05)',
        }}
      />

      {/* Radial glow — top right */}
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-[55vw] h-[45vh]"
        style={{ background: 'radial-gradient(ellipse at top right, rgba(15,27,60,0.05) 0%, transparent 65%)' }}
      />
    </div>
  )
}
