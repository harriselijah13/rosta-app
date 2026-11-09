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

const b = 'font-semibold'
const a = 'underline underline-offset-2 hover:text-navy transition-colors'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-warm-white">
      <header className="px-6 py-5 border-b border-border bg-warm-white">
        <a href="https://rosta.network" className="font-display text-xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </a>
      </header>

      <main className="max-w-[680px] mx-auto px-6 py-14">
        <p className="text-sm text-body-grey mb-3">Effective date: November 2026</p>
        <h1 className="font-display text-4xl font-bold text-navy mb-4">Privacy Policy</h1>
        <p className="text-[15px] text-navy/90 leading-relaxed mb-2">
          ROSTA is operated by FYNL Studio FC-LLC, registered in Ras Al Khaimah Economic Zone (RAKEZ), UAE. When this policy says &ldquo;ROSTA&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;, it means FYNL Studio FC-LLC operating the ROSTA app on iPhone and Android, the ROSTA platform at app.onrosta.com, and the website at rosta.network.
        </p>

        <Section heading="What We Collect">
          <p>
            <strong className={b}>Your account and profile.</strong> Your name, email address, and the professional information you choose to add: what you do, what you&rsquo;re building, who you want to meet, where you operate, your signals, your profile photo, and anything you add to The Blueprint.
          </p>
          <p>
            <strong className={b}>What you do on ROSTA.</strong> Your connections, introductions you ask for or make, messages and reactions, asks and offers, event RSVPs and check-ins, and the profiles you view. Private notes you keep about people you&rsquo;ve met are visible only to you.
          </p>
          <p>
            <strong className={b}>Business cards you scan.</strong> When you scan a card, the photo is sent to our AI provider only to read the details on it. We don&rsquo;t keep the photo: it is deleted from your phone&rsquo;s temporary storage straight after the card is read and is never added to your camera roll. We save only the details you confirm (such as the person&rsquo;s name, company, email, and phone number), and only you can see them.
          </p>
          <p>
            <strong className={b}>Approximate location (Networking Mode).</strong> If you switch on Networking Mode and choose to let your network nearby know, or leave nearby alerts on, the app uses your approximate location, and only while you&rsquo;re using it. We never track your location in the background and never use precise location. We store it rounded to roughly 100 metres, delete it within 6 hours, and never show it to anyone: other members only learn that you&rsquo;re nearby, never where you are or how far away. You can turn nearby alerts off at any time in Settings, which deletes your stored location immediately, or turn off location access for ROSTA in your phone&rsquo;s settings.
          </p>
          <p>
            <strong className={b}>Camera and photos.</strong> We only access your camera or photo library when you choose to add a profile photo, scan a business card, or scan a QR code.
          </p>
          <p>
            <strong className={b}>Notifications and your device.</strong> If you allow notifications we store a push token so we can send them. We also record whether you use iPhone or Android and which version of the app you have, so we can support and improve the app.
          </p>
          <p>
            <strong className={b}>Subscriptions.</strong> If you subscribe to ROSTA Premium, the purchase is handled by Apple or Google. We receive confirmation of your subscription status but never your payment details.
          </p>
          <p>
            <strong className={b}>Events and guests.</strong> If you connect at an event via Guest QR without an account, we collect your name, email, and a one-line description.
          </p>
          <p>
            <strong className={b}>Technical data.</strong> We collect some technical data automatically, such as IP address, browser type and basic usage, to keep ROSTA secure and working correctly.
          </p>
        </Section>

        <Section heading="Why We Collect It">
          <p>
            We collect your data to provide the ROSTA service: creating your profile, connecting you with people, facilitating introductions, letting your network nearby know when you&rsquo;re free to meet, sending notifications and emails, keeping the platform safe, and processing subscriptions. We do not sell your data. We do not use your data for advertising, and we do not track you across other companies&rsquo; apps or websites.
          </p>
        </Section>

        <Section heading="Who We Share It With">
          <p>
            We use the following third-party services to operate ROSTA. Each has its own privacy policy:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li><strong className={b}>Supabase</strong>: database, authentication and server functions</li>
            <li><strong className={b}>Resend</strong>: sign-in and account emails</li>
            <li><strong className={b}>Loops</strong>: waitlist and product update emails</li>
            <li><strong className={b}>Apple and Google</strong>: app distribution, in-app purchases for ROSTA Premium, and delivery of push notifications</li>
            <li><strong className={b}>RevenueCat</strong>: managing ROSTA Premium subscription status</li>
            <li><strong className={b}>Expo</strong>: app updates and sending push notifications to your device</li>
            <li><strong className={b}>Anthropic</strong>: AI features including intro drafting, signal matching, profile coaching, reading business cards you scan, and weekly digest emails. The relevant data is sent to Anthropic&rsquo;s API to generate these features; Anthropic does not use this data to train their models.</li>
            <li><strong className={b}>Vercel and Netlify</strong>: hosting for app.onrosta.com and rosta.network</li>
          </ul>
          <p>
            Other members see what you put on your profile and your signals. If you view someone&rsquo;s profile, they may see that you did if they have ROSTA Premium. If you RSVP or check in to an event run on ROSTA Host, the host sees that you&rsquo;re attending. We never show other members your email address, your location, or how many connections you have, and your phone number is only shared if you choose to share it in a conversation.
          </p>
        </Section>

        <Section heading="How Long We Keep It">
          <p>
            We keep your data for as long as your account is active. Approximate location is deleted within 6 hours, and business card photos are never kept. If you delete your account, which you can do from Settings in the app, we delete your personal data within 30 days. Some data may be retained longer where required by law.
          </p>
        </Section>

        <Section heading="Your Rights">
          <p>
            You have the right to access, correct, or delete your personal data at any time. You can edit your profile and delete your account in the app. To make any other request, email <a href="mailto:contact@onrosta.com" className={a}>contact@onrosta.com</a>. We will respond within 30 days. If you are based in the UK or EU you also have the right to data portability and to lodge a complaint with your local data protection authority.
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
            <a href="mailto:contact@onrosta.com" className={a}>contact@onrosta.com</a>
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
