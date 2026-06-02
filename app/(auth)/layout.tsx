import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-warm-white flex flex-col">
      <nav className="px-8 py-5">
        <Link href="/" className="font-display text-2xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  )
}
