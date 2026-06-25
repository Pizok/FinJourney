import Link from 'next/link';
import Image from 'next/image';


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
            <Image 
              src="/logo/logo.svg" 
              alt="FinJourney Logo" 
              width={28} 
              height={28} 
              className="rounded-[6px]"
            />
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
