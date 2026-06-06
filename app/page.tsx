import Link from 'next/link'
import HeroAnimation from './HeroAnimation'

// ── Icons ────────────────────────────────────────────────────────────────────

function IconProfile() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function IconSignal() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12z" />
    </svg>
  )
}

function IconIntro() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  )
}

function IconOutcome() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

// ── Data ─────────────────────────────────────────────────────────────────────

const PROBLEMS = [
  {
    heading: 'No feed',
    body: 'ROSTA has no public feed. Nothing to scroll, nothing to perform for.',
  },
  {
    heading: 'Warm introductions only',
    body: 'Every connection has context. No cold connect button, ever.',
  },
  {
    heading: 'Present-tense profiles',
    body: "What you're building now. Not your CV from three years ago.",
  },
]

const STEPS = [
  {
    icon: <IconProfile />,
    heading: 'Create your profile',
    body: "What you do, what you're building, who you want to meet.",
  },
  {
    icon: <IconSignal />,
    heading: 'Set your signals',
    body: 'Tell the network what you need right now.',
  },
  {
    icon: <IconIntro />,
    heading: 'Get introduced',
    body: 'Warm introductions through mutual connections, with context.',
  },
  {
    icon: <IconOutcome />,
    heading: 'Make it happen',
    body: 'Message, collaborate, mark real outcomes.',
  },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main>

      {/* ── Navy wrapper: nav + hero share the full viewport ── */}
      <div className="min-h-screen bg-navy flex flex-col">

        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10 relative z-20 shrink-0">
          <span className="font-display text-2xl font-bold tracking-tight text-warm-white">
            ROSTA<span className="text-lime">.</span>
          </span>
          <Link
            href="/login"
            className="text-sm font-medium text-warm-white border border-warm-white/30 px-4 py-2 rounded-full hover:bg-white/10 transition-colors"
          >
            Sign in
          </Link>
        </nav>

        {/* Hero */}
        <section className="flex-1 relative flex flex-col items-center justify-center text-center px-6 py-20">
          <HeroAnimation />

          <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
            {/* Eyebrow */}
            <span className="inline-flex items-center border border-lime/50 text-lime text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full mb-8">
              Now inviting RAK &amp; London
            </span>

            {/* Headline */}
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-warm-white leading-tight text-balance mb-7">
              The professional network built for people who are actually doing something.
            </h1>

            {/* Subheading */}
            <p className="text-warm-white/70 text-lg sm:text-xl max-w-2xl leading-relaxed text-balance mb-10">
              No feed. No follower counts. No cold messages. Just warm introductions, real conversations, and real outcomes.
            </p>

            {/* CTA */}
            <Link
              href="/signup"
              className="bg-lime text-navy font-semibold px-9 py-3.5 rounded-full hover:bg-lime/90 transition-colors text-base"
            >
              Create your profile
            </Link>
            <p className="text-warm-white/35 text-sm mt-5">
              Invite only · Free to join · Founding member spots limited
            </p>
          </div>
        </section>
      </div>

      {/* ── Problem strip ── */}
      <section className="bg-warm-white py-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {PROBLEMS.map(p => (
            <div key={p.heading} className="bg-white border border-border rounded-2xl p-8">
              <h3 className="font-display text-xl font-bold text-navy mb-3">{p.heading}</h3>
              <p className="text-body-grey text-sm leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-navy py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-warm-white text-center mb-14">
            Built differently. On purpose.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lime mb-5 shrink-0">
                  {step.icon}
                </div>
                <p className="text-xs font-semibold text-lime/70 tracking-widest uppercase mb-2">
                  Step {i + 1}
                </p>
                <h3 className="font-display text-lg font-bold text-warm-white mb-2">
                  {step.heading}
                </h3>
                <p className="text-warm-white/50 text-sm leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Founding member strip ── */}
      <section className="bg-lime py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-navy mb-5 text-balance leading-tight">
            The first 500 are founding members. Permanently.
          </h2>
          <p className="text-navy/70 text-lg mb-10">
            Founding member status never expires and can never be earned later.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-navy text-lime font-semibold px-9 py-3.5 rounded-full hover:bg-navy/90 transition-colors text-base"
          >
            Claim your spot
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-navy border-t border-white/10 px-8 py-7">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <span className="font-display text-lg font-bold text-warm-white">
            ROSTA<span className="text-lime">.</span>
          </span>
          <p className="text-warm-white/40 text-xs">Your real network.</p>
          <div className="flex items-center gap-4 text-xs text-warm-white/40">
            <Link href="/privacy" className="hover:text-warm-white/70 transition-colors">Privacy</Link>
            <span>·</span>
            <Link href="/terms"   className="hover:text-warm-white/70 transition-colors">Terms</Link>
            <span>·</span>
            <Link href="/cookies" className="hover:text-warm-white/70 transition-colors">Cookies</Link>
          </div>
        </div>
      </footer>

    </main>
  )
}
