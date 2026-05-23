import Link from 'next/link';

const FOOTER_LINKS = [
  { label: 'Pricing',          href: '/pricing' },
  { label: 'News',             href: '/news'    },
  { label: 'Privacy Policy',   href: '/privacy' },
  { label: 'Terms of Service', href: '/terms'   },
];

export default function Footer() {
  return (
    <footer className="bg-abyssal-slate border-t border-tactical-border">
      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* Top row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <span className="w-7 h-7 rounded-[6px] bg-muted-emerald flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L13 5.5V10.5L8 14L3 10.5V5.5L8 2Z" fill="#0F172A" />
              </svg>
            </span>
            <span className="font-display font-semibold text-base text-pearl-text tracking-tight">
              FinJourney
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-sans text-sm text-muted-text hover:text-pearl-text transition-colors duration-200"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-tactical-border">
          <p className="font-sans text-xs text-muted-text">
            © 2026 FinJourney. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
