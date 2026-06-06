'use client'

export default function HeroAnimation() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      <svg
        className="w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <style>{`
            @keyframes orbitCW  { from { transform: rotate(0deg); }    to { transform: rotate(360deg); }  }
            @keyframes orbitCCW { from { transform: rotate(0deg); }    to { transform: rotate(-360deg); } }
            @keyframes nodePulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.9; } }
            @keyframes lineFade  { 0%, 100% { opacity: 0; } 35%, 65% { opacity: 1; } }

            .g1 { transform-origin: 720px 450px; animation: orbitCW  70s linear infinite; }
            .g2 { transform-origin: 720px 450px; animation: orbitCCW 50s linear infinite; }
            .g3 { transform-origin: 720px 450px; animation: orbitCW 100s linear infinite; }

            .n  { animation: nodePulse 4s ease-in-out infinite; }
            .n1 { animation-delay: -1.2s; }
            .n2 { animation-delay: -2.5s; }
            .n3 { animation-delay: -0.7s; }
            .n4 { animation-delay: -3.3s; }

            .l  { animation: lineFade 7s ease-in-out infinite; }
            .l1 { animation-delay: -2.3s; }
            .l2 { animation-delay: -4.7s; }
            .l3 { animation-delay: -1.1s; }
            .l4 { animation-delay: -5.5s; }
            .l5 { animation-delay: -3.8s; }
          `}</style>
        </defs>

        {/* Orbit rings — static, concentric */}
        <circle cx="720" cy="450" r="170" fill="none" stroke="#C8F53C" strokeWidth="0.6" opacity="0.10"/>
        <circle cx="720" cy="450" r="300" fill="none" stroke="#C8F53C" strokeWidth="0.6" opacity="0.07"/>
        <circle cx="720" cy="450" r="450" fill="none" stroke="#F5F2EE" strokeWidth="0.5" opacity="0.05"/>
        <circle cx="720" cy="450" r="620" fill="none" stroke="#C8F53C" strokeWidth="0.4" opacity="0.04"/>

        {/* Orbiting group 1 — two lime nodes on inner orbit */}
        <g className="g1">
          <circle cx="720" cy="280" r="5" fill="#C8F53C" className="n n1"/>
          <circle cx="720" cy="620" r="4" fill="#C8F53C" className="n n3"/>
        </g>

        {/* Orbiting group 2 — two nodes on mid orbit, counter-clockwise */}
        <g className="g2">
          <circle cx="420"  cy="450" r="5" fill="#F5F2EE" className="n n2"/>
          <circle cx="1020" cy="450" r="5" fill="#C8F53C" className="n n4"/>
        </g>

        {/* Orbiting group 3 — outer orbit, slow */}
        <g className="g3">
          <circle cx="720"  cy="0"   r="4" fill="#F5F2EE" className="n n1"/>
          <circle cx="1170" cy="225" r="3" fill="#C8F53C" className="n n3"/>
          <circle cx="270"  cy="675" r="3" fill="#F5F2EE" className="n n2"/>
        </g>

        {/* Fixed ambient nodes */}
        <circle cx="160"  cy="180" r="3" fill="#F5F2EE" opacity="0.2" className="n n4"/>
        <circle cx="1280" cy="150" r="3" fill="#C8F53C" opacity="0.25" className="n n2"/>
        <circle cx="140"  cy="730" r="2" fill="#F5F2EE" opacity="0.18" className="n n1"/>
        <circle cx="1300" cy="710" r="3" fill="#C8F53C" opacity="0.2"  className="n n3"/>
        <circle cx="720"  cy="450" r="4" fill="#C8F53C" opacity="0.3"  className="n n2"/>

        {/* Fading connection lines between fixed reference points */}
        <line x1="720"  y1="280"  x2="1020" y2="450"  stroke="#C8F53C" strokeWidth="0.5" className="l"  opacity="0"/>
        <line x1="720"  y1="280"  x2="420"  y2="450"  stroke="#F5F2EE" strokeWidth="0.5" className="l l1" opacity="0"/>
        <line x1="420"  y1="450"  x2="720"  y2="620"  stroke="#C8F53C" strokeWidth="0.5" className="l l2" opacity="0"/>
        <line x1="720"  y1="620"  x2="1020" y2="450"  stroke="#F5F2EE" strokeWidth="0.5" className="l l3" opacity="0"/>
        <line x1="160"  y1="180"  x2="420"  y2="450"  stroke="#F5F2EE" strokeWidth="0.4" className="l l4" opacity="0"/>
        <line x1="1280" y1="150"  x2="1020" y2="450"  stroke="#C8F53C" strokeWidth="0.4" className="l l5" opacity="0"/>
        <line x1="720"  y1="450"  x2="1170" y2="225"  stroke="#C8F53C" strokeWidth="0.4" className="l l2" opacity="0"/>
        <line x1="720"  y1="450"  x2="270"  y2="675"  stroke="#F5F2EE" strokeWidth="0.4" className="l l4" opacity="0"/>
      </svg>
    </div>
  )
}
