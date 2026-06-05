import Link from 'next/link'

export const metadata = { title: 'Terms of Service — ROSTA' }

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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-warm-white">
      <header className="px-6 py-5 border-b border-border bg-warm-white">
        <Link href="/dashboard" className="font-display text-xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </Link>
      </header>

      <main className="max-w-[680px] mx-auto px-6 py-14">
        <p className="text-sm text-body-grey mb-3">Effective date: June 2026</p>
        <h1 className="font-display text-4xl font-bold text-navy mb-4">Terms of Service</h1>
        <p className="text-[15px] text-navy/90 leading-relaxed mb-2">
          These terms govern your use of ROSTA, operated by FYNL Studio FC-LLC (RAKEZ, UAE). By creating an account you agree to these terms.
        </p>

        <Section heading="What ROSTA Is">
          <p>
            ROSTA is an invite-only professional networking platform. It is designed for people aged 18 and over who are actively building things professionally. ROSTA is not a business directory, a social media platform, or a public network.
          </p>
        </Section>

        <Section heading="Your Account">
          <p>
            You are responsible for keeping your account credentials secure. You must provide accurate information. You may only have one account. Founding member status is permanent and non-transferable once granted.
          </p>
        </Section>

        <Section heading="What You Can Do">
          <p>
            You can create a profile, connect with other members, send and receive introductions, message connections, and participate in Open Tables. You can pay for ROSTA Verified to receive a verification badge on your profile.
          </p>
        </Section>

        <Section heading="What You Cannot Do">
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>Use ROSTA to spam, harass, or send unsolicited messages to other members</li>
            <li>Impersonate another person</li>
            <li>Scrape, copy, or extract member data</li>
            <li>Use ROSTA for any unlawful purpose</li>
            <li>Create fake or misleading profiles</li>
          </ul>
        </Section>

        <Section heading="Content">
          <p>
            You own the content you post on ROSTA. By posting it you grant us a licence to display it to other members as part of the service. We do not claim ownership of your content.
          </p>
        </Section>

        <Section heading="Verification">
          <p>
            ROSTA Verified is a one-time payment. The price is set in AED and may vary based on your membership tier. Verification is subject to review and approval. We reserve the right to revoke verification if a member&rsquo;s profile no longer meets our standards. Payments are non-refundable once verification is granted.
          </p>
        </Section>

        <Section heading="Removal">
          <p>
            We reserve the right to remove any member who violates these terms, behaves in a way that is harmful to the community, or misrepresents themselves on the platform. We will notify you by email if your account is removed.
          </p>
        </Section>

        <Section heading="Liability">
          <p>
            ROSTA is provided as a platform for professional networking. We are not responsible for the outcomes of any introductions, connections, or professional relationships made through the platform. We do not guarantee that the platform will be available at all times.
          </p>
        </Section>

        <Section heading="Governing Law">
          <p>
            These terms are governed by the laws of the United Arab Emirates. Any disputes will be resolved under UAE jurisdiction.
          </p>
        </Section>

        <Section heading="Changes">
          <p>
            We may update these terms from time to time. We will notify members by email of significant changes. Continued use of ROSTA after changes constitutes acceptance.
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
          <Link href="/cookies" className="hover:text-navy transition-colors">Cookie Policy</Link>
        </div>
      </main>
    </div>
  )
}
