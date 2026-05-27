import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing — FinJourney',
  description: 'Start free and grow at your own pace.',
};

/* ── Icon ────────────────────────────────────────────────────── */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 7.5L5.5 11L12 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Feature lists ───────────────────────────────────────────── */
const FREE_FEATURES = [
  '3 Wallets & 10 Categories',
  'Daily Budget System',
  'HP & XP Progression',
  'Financial Challenges',
  'Basic Insights & Reviews',
];

const PRO_FEATURES = [
  'Unlimited Wallets & Categories',
  'Advanced Analytics',
  'Monthly Financial Reports',
  'Custom Tasks & Goals',
  'Exclusive Themes & Cosmetics',
];

/* ── Page ────────────────────────────────────────────────────── */
export default function PricingPage() {
  return (
    /*
      Background: Abyssal Slate (#0F172A) — replaces the incorrect midnight-sky
      token and eliminates the pure-black (#000000) anti-pattern.
    */
    <div className="bg-abyssal-slate min-h-screen">

      {/* ── Page Header ──────────────────────────────────── */}
      <section className="pt-24 pb-16 text-center">
        <div className="max-w-7xl mx-auto px-6">

          {/*
            Eyebrow: tiny uppercase label — permitted per DESIGN.md.
            Border uses tactical-border at low opacity; no teal color on the line
            itself, keeping accent strictly restrained (≤10% surface coverage).
          */}
          <span className="inline-block font-display font-semibold text-[11px] tracking-widest uppercase text-muted-emerald border-b border-tactical-border pb-1 mb-8">
            Pricing
          </span>

          {/*
            H1: weight reduced from bold → semibold per restrained weight strategy.
            text-pearl-text replaces the undefined starlight-text token.
          */}
          <h1 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl text-pearl-text tracking-tight mb-4">
            Simple Pricing for Your Journey
          </h1>

          <p className="font-sans text-base text-muted-text max-w-md mx-auto">
            Start free and grow at your own pace.
          </p>

        </div>
      </section>

      {/* ── Pricing Cards ────────────────────────────────── */}
      <section className="pb-32">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Free Tier ────────────────────────────────── */}
            <div className="bg-canvas-surface border border-tactical-border rounded-xl p-10 flex flex-col gap-8">

              {/* Label + Price */}
              <div>
                {/*
                  Tier label: uppercase permitted for tiny badge labels.
                  muted-text keeps this firmly secondary — no accent color here.
                */}
                <p className="font-sans text-xs font-medium tracking-widest uppercase text-muted-text mb-3">
                  Free Tier
                </p>
                <div className="flex items-end gap-2">
                  <span className="font-display font-semibold text-5xl text-pearl-text leading-none tabular-nums">
                    Rp 0
                  </span>
                  <span className="font-sans text-sm text-muted-text pb-1">/ forever</span>
                </div>
              </div>

              <div className="border-t border-tactical-border" />

              {/* Features */}
              <ul className="flex flex-col gap-3">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    {/*
                      Check icon: muted-text keeps the free tier visually secondary
                      relative to the Pro tier's muted-emerald checks below.
                    */}
                    <CheckIcon className="text-muted-text shrink-0" />
                    <span className="font-sans text-base text-muted-text">{f}</span>
                  </li>
                ))}
              </ul>

              {/*
                Free tier CTA: ghost button — transparent bg, tactical-border.
                Hover transitions to pearl-text only; no color accent on hover
                for the secondary option.
              */}
              <Link
                href="/signup"
                className="mt-auto block text-center font-display font-semibold text-sm text-muted-text border border-tactical-border rounded-xl py-3.5 hover:text-pearl-text hover:border-pearl-text/30 transition-colors duration-200"
              >
                Start for Free
              </Link>

            </div>

            {/* ── Pro Tier ─────────────────────────────────── */}
            {/*
              Border: tactical-border replaces the loud teal border.
              No radial-gradient glow overlay — decorative noise, banned.
              No drop-shadow on the card itself.
            */}
            <div className="relative bg-canvas-surface border border-tactical-border rounded-xl p-10 flex flex-col gap-8">

              {/*
                "In Development" badge: Dawn Gold is the correct milestone token.
                Flat bg with low-opacity border — no glow.
                Uppercase permitted: tiny badge label.
              */}
              <span className="absolute top-4 right-4 bg-dawn-gold/10 border border-dawn-gold/25 text-dawn-gold font-sans font-medium text-[11px] tracking-widest uppercase rounded-md px-2.5 py-1">
                In Development
              </span>

              {/* Label + Price */}
              <div>
                {/*
                  Pro label uses muted-emerald — this is the one surface where
                  the primary accent earns its place as a differentiator.
                  Kept small; the accent stays well within the 10% rule.
                */}
                <p className="font-sans text-xs font-medium tracking-widest uppercase text-muted-emerald mb-3">
                  Pro Tier
                </p>
                <div className="flex items-end gap-3 flex-wrap">
                  <span className="font-display font-semibold text-5xl text-pearl-text leading-none tabular-nums">
                    Rp 0
                  </span>
                  <div className="flex flex-col pb-1 gap-0.5">
                    <span className="font-sans text-sm text-muted-text line-through tabular-nums">
                      Rp 49,000 / month
                    </span>
                    <span className="font-sans text-xs text-muted-text">during development</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-tactical-border" />

              {/* Features */}
              <ul className="flex flex-col gap-3">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    {/*
                      Pro check icons use muted-emerald — the only place the
                      primary accent appears in the feature list, reinforcing
                      the tier differentiation without overpowering it.
                    */}
                    <CheckIcon className="text-muted-emerald shrink-0" />
                    <span className="font-sans text-base text-muted-text">{f}</span>
                  </li>
                ))}
              </ul>

              {/*
                Primary CTA: solid muted-emerald bg, abyssal-slate text for
                contrast. This is the one element in the design that earns the
                full accent treatment. No glow (shadow-* removed). No
                brightness-110 hover (amplified the banned glow). Border-hover
                only for a clean, restrained interaction.
              */}
              <Link
                href="/signup"
                className="mt-auto block text-center font-display font-semibold text-sm text-abyssal-slate bg-muted-emerald rounded-xl py-3.5 hover:opacity-90 transition-opacity duration-200"
              >
                Get Pro Access
              </Link>

            </div>

          </div>

          {/* Fine print */}
          <p className="font-sans text-xs text-muted-text text-center mt-8">
            Pro features are free during development. Pricing activates at launch.
          </p>

        </div>
      </section>

    </div>
  );
}
