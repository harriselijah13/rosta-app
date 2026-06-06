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
            href="/login"
            className="text-sm font-medium text-navy border border-navy px-4 py-2 rounded-full hover:bg-navy hover:text-warm-white transition-colors"
          >
            Sign in
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-24 bg-navy">
        <p className="text-lime text-sm font-medium tracking-widest uppercase mb-6">
          Now inviting RAK &amp; London
        </p>
        <h1 className="font-display text-5xl sm:text-7xl font-bold text-warm-white leading-tight text-balance max-w-4xl mb-6">
          Build connections that actually matter
        </h1>
        <p className="text-warm-white/70 text-lg max-w-xl mb-10 text-balance">
          The professional network built around real introductions. No feed. No performing. No hollow connections.
        </p>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <a
            href="/signup"
            className="bg-lime text-navy font-semibold px-8 py-3 rounded-full hover:bg-lime/90 transition-colors"
          >
            Sign up
          </a>
        </div>
      </section>

      {/* Foundation strip */}
      <section id="about" className="bg-surface border-t border-border px-8 py-6 flex items-center justify-center">
        <p className="text-body-grey text-sm text-center">
          Foundation is set — features coming soon.
        </p>
      </section>
    </main>
  );
}
