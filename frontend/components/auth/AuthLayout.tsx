'use client';
// components/auth/AuthLayout.tsx
// Split-screen layout: form (left) + illustration placeholder (right).
// Auth stage tone: Clean / Trustworthy — no star-fields, no blobs, no gradients.

import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    /*
      Background: Abyssal Slate (#0F172A).
      Replaces bg-midnight-sky (wrong token) and eliminates pure-black (#000000).
    */
    <div className="min-h-screen bg-abyssal-slate flex">

      {/* ── Left: form panel ───────────────────────────────────────── */}
      {/*
        flex-col so brand mark sits above the card naturally.
        py-16 gives generous top/bottom breathing room.
        lg:max-w-[560px] caps width so the right panel gets adequate space.
      */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 lg:max-w-[560px]">

        {/* Brand mark — typographic only, no icon, no color accent */}
        <div className="w-full max-w-[440px] mb-10">
          <span className="font-display font-semibold text-sm text-pearl-text tracking-tight">
            FinJourney
          </span>
        </div>

        {/*
          Auth card: flat Canvas Surface (#1E293B).
          1px Tactical Border (#334155). Zero outer glow. rounded-xl. p-10.
          Typography and spacing inside each form carry all hierarchy.
        */}
        <div className="w-full max-w-[440px] bg-canvas-surface border border-tactical-border rounded-xl p-10">
          {children}
        </div>

        {/* Footer fine print */}
        <p className="w-full max-w-[440px] mt-6 font-sans text-xs text-muted-text text-center leading-relaxed">
          By continuing, you agree to FinJourney&apos;s{' '}
          <span className="text-pearl-text underline underline-offset-2 cursor-pointer hover:text-muted-emerald transition-colors duration-150">
            Terms of Service
          </span>{' '}
          and{' '}
          <span className="text-pearl-text underline underline-offset-2 cursor-pointer hover:text-muted-emerald transition-colors duration-150">
            Privacy Policy
          </span>
          .
        </p>

      </div>

      {/* ── Right: illustration placeholder ───────────────────────── */}
      {/*
        Auth stage tone: Clean / Trustworthy.
        Stripped: star-field, grid-overlay, concentric rings, orbit dots,
        teal-dominant accents, stat chips. All decorative noise banned here.

        Flat Canvas Surface panel held for the illustration asset system.
        A minimal labeled frame signals the reserved space without decorating.
      */}
      <div className="hidden lg:flex flex-1 relative bg-canvas-surface border-l border-tactical-border items-center justify-center">

        <div className="flex flex-col items-center gap-5 px-12 text-center">

          {/*
            Placeholder frame: 1px tactical-border square, muted label.
            No glow. No accent color. No animation.
            Renderer / illustration system will replace this.
          */}
          <div className="w-48 h-48 border border-tactical-border rounded-xl flex items-center justify-center">
            <span className="font-sans text-xs text-muted-text tracking-widest uppercase">
              Illustration
            </span>
          </div>

          {/* Tagline — hierarchy via weight and spacing only */}
          <div className="flex flex-col gap-2 max-w-xs">
            <h2 className="font-display font-semibold text-xl text-pearl-text tracking-tight leading-snug">
              The Clear Night Journey
            </h2>
            <p className="font-sans text-sm text-muted-text leading-relaxed">
              Track your finances, build discipline, and progress through a
              long-term adventure — one daily budget at a time.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
