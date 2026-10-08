import Link from 'next/link'

export const metadata = { title: 'Delete Your Account — ROSTA' }

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

// Google Play's account-deletion policy requires a web page, reachable without
// installing the app or signing in, that either performs deletion or gives a clear
// path to request it. Apple has no equivalent requirement — the in-app screen at
// app/(app)/delete-account.tsx satisfies Apple alone. This page and that screen
// must stay in sync: same list of what's deleted, same subscription disclosure.
export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-warm-white">
      <header className="px-6 py-5 border-b border-border bg-warm-white">
        <a href="https://rosta.network" className="font-display text-xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </a>
      </header>

      <main className="max-w-[680px] mx-auto px-6 py-14">
        <h1 className="font-display text-4xl font-bold text-navy mb-4">Delete your account</h1>
        <p className="text-[15px] text-navy/90 leading-relaxed mb-2">
          You can delete your ROSTA account and all of your data at any time. There are two ways to do it.
        </p>

        <Section heading="From the app">
          <p>
            Open ROSTA, go to <strong className="font-semibold">Settings → Delete account</strong>, type DELETE
            to confirm, and tap Delete my account. This happens immediately.
          </p>
        </Section>

        <Section heading="Without the app">
          <p>
            Email <a href="mailto:contact@onrosta.com?subject=Delete%20my%20ROSTA%20account" className="underline underline-offset-2 hover:text-navy transition-colors">contact@onrosta.com</a> from
            the address on your ROSTA account and ask us to delete it. We&rsquo;ll confirm your identity and delete
            your account and data within 30 days.
          </p>
        </Section>

        <Section heading="What gets deleted">
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>Your profile, signals and Blueprint</li>
            <li>Your connections, and any introductions you asked for or facilitated</li>
            <li>Your private notes and conversation outcomes</li>
            <li>Your messages and conversations</li>
            <li>Any invite codes you have not yet shared</li>
          </ul>
          <p>This is immediate and cannot be undone.</p>
        </Section>

        <Section heading="Your subscription is separate">
          <p>
            ROSTA Premium is billed by Apple or Google through your account with them, not by us. Deleting your
            ROSTA account does not cancel it, and it will keep renewing until you cancel it yourself — in
            Settings on iOS, or in the Google Play app on Android.
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
