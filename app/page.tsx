export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border">
        <span className="font-display text-2xl font-bold tracking-tight text-navy">
          ROSTA<span className="text-lime">.</span>
        </span>
        <div className="flex items-center gap-4">
          <a
            href="#"
            className="text-sm text-body-grey hover:text-navy transition-colors"
          >
            Sign in
          </a>
          <a
            href="#"
            className="text-sm font-medium bg-navy text-warm-white px-4 py-2 rounded-full hover:bg-navy/90 transition-colors"
          >
            Get started
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 bg-navy">
        <p className="text-lime text-sm font-medium tracking-widest uppercase mb-6">
          Professional Networking — Reimagined
        </p>
        <h1 className="font-display text-5xl sm:text-7xl font-bold text-warm-white leading-tight text-balance max-w-4xl mb-6">
          Build connections that actually matter
        </h1>
        <p className="text-warm-white/70 text-lg max-w-xl mb-10 text-balance">
          ROSTA brings professionals together around shared work, not vanity metrics. Showcase what you do, find who you need.
        </p>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <a
            href="#"
            className="bg-lime text-navy font-semibold px-8 py-3 rounded-full hover:bg-lime/90 transition-colors"
          >
            Join the waitlist
          </a>
          <a
            href="#"
            className="text-warm-white border border-warm-white/30 px-8 py-3 rounded-full hover:border-warm-white/60 transition-colors text-sm"
          >
            Learn more
          </a>
        </div>
      </section>

      {/* Foundation strip */}
      <section className="bg-surface border-t border-border px-8 py-6 flex items-center justify-center">
        <p className="text-body-grey text-sm text-center">
          Foundation is set — features coming soon.
        </p>
      </section>
    </main>
  );
}
