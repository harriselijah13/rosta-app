import Link from 'next/link'

const SECTIONS = [
  { id: 'signals',         label: 'Signals' },
  { id: 'connections',     label: 'Connections' },
  { id: 'intro-credits',   label: 'Intro credits' },
  { id: 'open-tables',     label: 'Open Tables' },
  { id: 'connector-score', label: 'Connector Score' },
  { id: 'verified',        label: 'Verified' },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-warm-white">
      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* Header */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-body-grey hover:text-navy transition-colors mb-10"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </Link>

        <p className="text-xs font-semibold uppercase tracking-widest text-body-grey mb-2">ROSTA</p>
        <h1 className="font-display text-4xl font-bold text-navy mb-10">How it works</h1>

        {/* Anchor nav */}
        <nav className="flex flex-wrap gap-2 mb-12 pb-8 border-b border-border">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-sm font-medium text-navy border border-border px-3 py-1.5 rounded-full hover:border-navy hover:bg-surface transition-colors"
            >
              {s.label}
            </a>
          ))}
        </nav>

        {/* Sections */}
        <div className="space-y-14">

          <section id="signals">
            <h2 className="font-display text-2xl font-bold text-navy mb-4">Signals</h2>
            <p className="text-[15px] text-body-grey leading-relaxed">
              Signals are three short fields on your profile: what you&apos;re working on right now, what you need right now, and what kinds of conversations you&apos;re open to. They&apos;re not permanent — update them when your situation changes. Your connections see a notification on their dashboard when your signals change. Think of them as a standing message to your network about where you are and what would be useful.
            </p>
          </section>

          <section id="connections">
            <h2 className="font-display text-2xl font-bold text-navy mb-4">Connections</h2>
            <p className="text-[15px] text-body-grey leading-relaxed">
              There are three ways to connect on ROSTA. A warm introduction — you request an intro through a mutual connection who facilitates it with context. Open Door — some members have this active, which means you can connect directly without a mutual connection. QR — at events, scan another member&apos;s QR code to connect instantly. Once you&apos;re connected, you can message each other directly.
            </p>
          </section>

          <section id="intro-credits">
            <h2 className="font-display text-2xl font-bold text-navy mb-4">Intro credits</h2>
            <p className="text-[15px] text-body-grey leading-relaxed">
              You have 3 intro credits per month. Each time you request a warm introduction, it costs one credit. Credits reset on the first of every month. You earn a credit back each time you facilitate an introduction for someone else — so the more generous you are, the more you can request.
            </p>
          </section>

          <section id="open-tables">
            <h2 className="font-display text-2xl font-bold text-navy mb-4">Open Tables</h2>
            <p className="text-[15px] text-body-grey leading-relaxed">
              Open Tables are monthly small-group conversations. Opt in and ROSTA matches you with 4 to 6 members based on your signals. You get a private room for 7 days. There&apos;s a simple prompt to start — after that the conversation goes where it goes. Rooms close after 7 days and aren&apos;t archived. If something useful comes from it, mark the outcome and it counts toward your Connector Score.
            </p>
          </section>

          <section id="connector-score">
            <h2 className="font-display text-2xl font-bold text-navy mb-4">Connector Score</h2>
            <p className="text-[15px] text-body-grey leading-relaxed">
              Your Connector Score reflects how active you are in the network — specifically how much you give, not just take. You earn points for facilitating introductions, having conversations that go somewhere, marking real outcomes, and completing your weekly challenge. The score feeds into your badge progression. It&apos;s visible on your profile but it&apos;s not a leaderboard — it&apos;s a personal record of what you&apos;ve contributed.
            </p>
          </section>

          <section id="verified">
            <h2 className="font-display text-2xl font-bold text-navy mb-4">Verified</h2>
            <p className="text-[15px] text-body-grey leading-relaxed">
              ROSTA Verified is a one-time identity and profile check. It means the person is who they say they are and their profile accurately represents them. Verification is manual — applied for and reviewed. It shows as a tick next to your name.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border">
          <p className="text-xs text-body-grey flex items-center justify-center gap-2 flex-wrap">
            <Link href="/privacy" className="hover:text-navy transition-colors">Privacy Policy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-navy transition-colors">Terms</Link>
            <span>·</span>
            <Link href="/dashboard" className="hover:text-navy transition-colors">Dashboard</Link>
          </p>
        </div>

      </div>
    </div>
  )
}
