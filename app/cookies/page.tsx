import Link from 'next/link'

export const metadata = { title: 'Cookie Policy — ROSTA' }

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-base font-bold text-navy uppercase tracking-widest mb-3">
        {heading}
      </h2>
      <div className="space-y-3 text-navy/90 text-[15px] leading-relaxed">
        {children}
      </div>
    </section>
  )
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-warm-white">
      <header className="px-6 py-5 border-b border-border bg-warm-white">
        <Link href="/dashboard" className="font-display text-xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </Link>
      </header>

      <main className="max-w-[680px] mx-auto px-6 py-14">
        <p className="text-sm text-body-grey mb-3">Effective date: June 2026</p>
        <h1 className="font-display text-4xl font-bold text-navy mb-4">Cookie Policy</h1>
        <p className="text-[15px] text-navy/90 leading-relaxed mb-2">
          ROSTA uses cookies and similar technologies to keep you logged in and to keep the platform secure.
        </p>

        <Section heading="What We Use">
          <div className="space-y-4">
            <div className="border-l-2 border-lime pl-4">
              <p className="font-semibold text-navy mb-1">Authentication cookies</p>
              <p>
                Set by Supabase to keep you logged in. These are essential. Without them the platform does not work.
              </p>
            </div>
            <div className="border-l-2 border-border pl-4">
              <p className="font-semibold text-navy mb-1">Session cookies</p>
              <p>
                Temporary cookies that expire when you close your browser. Used for security.
              </p>
            </div>
          </div>
          <p className="mt-4 text-body-grey text-sm">
            We do not use advertising cookies. We do not use tracking cookies. We do not use analytics cookies that follow you across other websites.
          </p>
        </Section>

        <Section heading="Your Choices">
          <p>
            Because the cookies we use are essential for the platform to function, they cannot be turned off without logging out. If you do not want cookies set, do not create a ROSTA account.
          </p>
        </Section>

        <Section heading="Contact">
          <p>
            <a href="mailto:contact@onrosta.com" className="underline underline-offset-2 hover:text-navy transition-colors">contact@onrosta.com</a>
          </p>
        </Section>

        <div className="mt-14 pt-8 border-t border-border flex flex-wrap gap-4 text-xs text-body-grey">
          <Link href="/privacy" className="hover:text-navy transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-navy transition-colors">Terms of Service</Link>
        </div>
      </main>
    </div>
  )
}
