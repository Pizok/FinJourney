'use client';
import Link from 'next/link';
import { useState } from 'react';

const NAV_LINKS = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'News',    href: '/news'    },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-abyssal-slate border-b border-tactical-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* ── Logo ─────────────────────────────── */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-7 h-7 rounded-[6px] bg-muted-emerald flex items-center justify-center">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L13 5.5V10.5L8 14L3 10.5V5.5L8 2Z" fill="#0F172A" />
            </svg>
          </span>
          <span className="font-display font-semibold text-lg text-pearl-text tracking-tight">
            FinJourney
          </span>
        </Link>

        {/* ── Desktop Nav ───────────────────────── */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-sans text-sm text-muted-text hover:text-pearl-text transition-colors duration-200"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* ── Desktop CTA Buttons ───────────────── */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/auth?view=login"
            className="font-sans text-sm text-muted-text border border-tactical-border rounded-lg px-4 py-2 hover:border-pearl-text hover:text-pearl-text transition-colors duration-200"
          >
            Sign In
          </Link>
          <Link
            href="/auth?view=signup"
            className="font-display font-semibold text-sm text-abyssal-slate bg-muted-emerald rounded-lg px-5 py-2 hover:brightness-90 transition-all duration-200"
          >
            Try Now
          </Link>
        </div>

        {/* ── Mobile Toggle ─────────────────────── */}
        <button
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          className="md:hidden text-muted-text hover:text-pearl-text transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {open ? (
              <><line x1="4" y1="4" x2="18" y2="18" /><line x1="18" y1="4" x2="4" y2="18" /></>
            ) : (
              <><line x1="3" y1="7" x2="19" y2="7" /><line x1="3" y1="11" x2="19" y2="11" /><line x1="3" y1="15" x2="19" y2="15" /></>
            )}
          </svg>
        </button>
      </div>

      {/* ── Mobile Dropdown ───────────────────── */}
      {open && (
        <div className="md:hidden bg-abyssal-slate border-t border-tactical-border px-6 py-5 flex flex-col gap-4">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="font-sans text-sm text-muted-text hover:text-pearl-text transition-colors duration-200"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 pt-3 border-t border-tactical-border">
            <Link
              href="/auth?view=login"
              onClick={() => setOpen(false)}
              className="font-sans text-sm text-center text-muted-text border border-tactical-border rounded-xl py-2.5 hover:text-pearl-text hover:border-pearl-text transition-colors duration-200"
            >
              Sign In
            </Link>
            <Link
              href="/auth?view=signup"
              onClick={() => setOpen(false)}
              className="font-display font-semibold text-sm text-center text-abyssal-slate bg-muted-emerald rounded-xl py-2.5 hover:brightness-90 transition-all duration-200"
            >
              Try Now
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
