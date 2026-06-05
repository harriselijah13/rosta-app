import Link from 'next/link'

export const metadata = { title: 'Privacy Policy — ROSTA' }

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

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-warm-white">
      <header className="px-6 py-5 border-b border-border bg-warm-white">
        <Link href="/dashboard" className="font-display text-xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </Link>
      </header>

      <main className="max-w-[680px] mx-auto px-6 py-14">
        <p className="text-sm text-body-grey mb-3">Effective date: June 2026</p>
        <h1 className="font-display text-4xl font-bold text-navy mb-4">Privacy Policy</h1>
        <p className="text-[15px] text-navy/90 leading-relaxed mb-2">
          ROSTA is operated by FYNL Studio FC-LLC, registered in Ras Al Khaimah Economic Zone (RAKEZ), UAE. When this policy says &ldquo;ROSTA&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;, it means FYNL Studio FC-LLC operating the ROSTA platform at app.onrosta.com.
        </p>

        <Section heading="What We Collect">
          <p>
            When you create a ROSTA account we collect your name, email address, and the professional information you choose to add to your profile — what you do, what you&rsquo;re building, who you want to meet, your location, and your signals. If you pay for ROSTA Verified we collect payment information, which is processed by Stripe and never stored on our servers. If you connect at an event via Guest QR without an account, we collect your name, email, and one-line description.
          </p>
          <p>
            We also collect technical data automatically — your IP address, browser type, and how you use the platform. We use this to keep the platform secure and working correctly.
          </p>
        </Section>

        <Section heading="Why We Collect It">
          <p>
            We collect your data to provide the ROSTA service — creating your profile, facilitating introductions, sending notifications, and processing payments. We do not sell your data. We do not use your data for advertising.
          </p>
        </Section>

        <Section heading="Who We Share It With">
          <p>
            We use the following third-party services to operate ROSTA. Each has its own privacy policy:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li><strong className="font-semibold">Supabase</strong> — database and authentication hosting</li>
            <li><strong className="font-semibold">Resend</strong> — transactional email delivery</li>
            <li><strong className="font-semibold">Stripe</strong> — payment processing for ROSTA Verified</li>
            <li><strong className="font-semibold">Anthropic</strong> — AI features including intro drafting, signal matching, profile coaching, and weekly digest emails. Your profile data is sent to Anthropic&rsquo;s API to generate these features; Anthropic does not use this data to train their models.</li>
            <li><strong className="font-semibold">Vercel</strong> — platform hosting</li>
            <li><strong className="font-semibold">Loops</strong> — waitlist management</li>
          </ul>
        </Section>

        <Section heading="How Long We Keep It">
          <p>
            We keep your data for as long as your account is active. If you delete your account we delete your personal data within 30 days. Some data may be retained longer where required by law.
          </p>
        </Section>

        <Section heading="Your Rights">
          <p>
            You have the right to access, correct, or delete your personal data at any time. To make a request, email <a href="mailto:contact@onrosta.com" className="underline underline-offset-2 hover:text-navy transition-colors">contact@onrosta.com</a>. We will respond within 30 days. If you are based in the UK or EU you also have the right to data portability and to lodge a complaint with your local data protection authority.
          </p>
        </Section>

        <Section heading="Data Transfers">
          <p>
            ROSTA is operated from the UAE. Your data may be processed in the United States or European Union by our third-party service providers. We ensure appropriate safeguards are in place for any international data transfers.
          </p>
        </Section>

        <Section heading="Children">
          <p>
            ROSTA is for people aged 18 and over. We do not knowingly collect data from anyone under 18.
          </p>
        </Section>

        <Section heading="Changes to This Policy">
          <p>
            We may update this policy from time to time. We will notify members by email of any significant changes. The current version is always available at app.onrosta.com/privacy.
          </p>
        </Section>

        <Section heading="Contact">
          <p>
            <a href="mailto:contact@onrosta.com" className="underline underline-offset-2 hover:text-navy transition-colors">contact@onrosta.com</a>
          </p>
        </Section>

        <div className="mt-14 pt-8 border-t border-border flex flex-wrap gap-4 text-xs text-body-grey">
          <Link href="/terms" className="hover:text-navy transition-colors">Terms of Service</Link>
          <span>·</span>
          <Link href="/cookies" className="hover:text-navy transition-colors">Cookie Policy</Link>
        </div>
      </main>
    </div>
  )
}
