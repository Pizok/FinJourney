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
    <header className="fixed top-0 inset-x-0 z-50 bg-midnight-sky/90 border-b border-clean-border backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* ── Logo ─────────────────────────────── */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-7 h-7 rounded-[6px] bg-refreshing-teal flex items-center justify-center">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L13 5.5V10.5L8 14L3 10.5V5.5L8 2Z" fill="#0D141E" />
            </svg>
          </span>
          <span className="font-display font-semibold text-lg text-starlight-text tracking-tight">
            FinJourney
          </span>
        </Link>

        {/* ── Desktop Nav ───────────────────────── */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-sans text-sm text-muted-text hover:text-starlight-text transition-colors duration-200"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* ── Desktop CTA Buttons ───────────────── */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="font-sans text-sm text-muted-text border border-clean-border rounded-xl px-4 py-2 hover:border-dawn-gold hover:text-starlight-text transition-colors duration-200"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="font-display font-semibold text-sm text-midnight-sky bg-refreshing-teal rounded-xl px-5 py-2 hover:brightness-110 transition-all duration-200 shadow-[0_4px_16px_rgba(45,212,191,0.2)]"
          >
            Try Now
          </Link>
        </div>

        {/* ── Mobile Toggle ─────────────────────── */}
        <button
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          className="md:hidden text-muted-text hover:text-starlight-text transition-colors"
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
        <div className="md:hidden bg-slate-canvas border-t border-clean-border px-6 py-5 flex flex-col gap-4">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="font-sans text-sm text-muted-text"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 pt-3 border-t border-clean-border">
            <Link href="/login" onClick={() => setOpen(false)} className="font-sans text-sm text-center text-muted-text border border-clean-border rounded-xl py-2.5">Sign In</Link>
            <Link href="/signup" onClick={() => setOpen(false)} className="font-display font-semibold text-sm text-center text-midnight-sky bg-refreshing-teal rounded-xl py-2.5">Try Now</Link>
          </div>
        </div>
      )}
    </header>
  );
}
