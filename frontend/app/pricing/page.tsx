import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing — FinJourney',
  description: 'Start free and grow at your own pace.',
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7.5L5.5 11L12 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

export default function PricingPage() {
  return (
    <div className="bg-midnight-sky min-h-screen">

      {/* ── Page Header ────────────────────────────────────── */}
      <section className="pt-24 pb-16 text-center">
        <div className="max-w-7xl mx-auto px-6">
          <span className="inline-flex items-center gap-2 bg-refreshing-teal/10 border border-refreshing-teal/30 text-refreshing-teal font-sans font-medium text-xs tracking-widest uppercase rounded-full px-4 py-1.5 mb-6">
            Pricing
          </span>
          <h1 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl text-starlight-text tracking-tight mb-4">
            Simple Pricing for Your Journey
          </h1>
          <p className="font-sans text-lg text-muted-text">
            Start free and grow at your own pace.
          </p>
        </div>
      </section>

      {/* ── Pricing Cards ──────────────────────────────────── */}
      <section className="pb-32">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Free Tier ── */}
            <div className="bg-slate-canvas border border-clean-border rounded-2xl p-10 flex flex-col gap-8">
              {/* Label + Price */}
              <div>
                <p className="font-sans text-xs font-medium tracking-widest uppercase text-muted-text mb-3">
                  Free Tier
                </p>
                <div className="flex items-end gap-2">
                  <span className="font-display font-bold text-5xl text-starlight-text leading-none">
                    Rp 0
                  </span>
                  <span className="font-sans text-sm text-muted-text pb-1">/ forever</span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-clean-border" />

              {/* Features */}
              <ul className="flex flex-col gap-3">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckIcon className="text-refreshing-teal shrink-0" />
                    <span className="font-sans text-sm text-muted-text">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href="/signup"
                className="mt-auto block text-center font-display font-semibold text-sm text-starlight-text border border-clean-border rounded-xl py-3.5 hover:border-refreshing-teal hover:text-refreshing-teal transition-colors duration-200"
              >
                Start for Free
              </Link>
            </div>

            {/* ── Pro Tier ── */}
            <div className="relative bg-slate-canvas border border-refreshing-teal rounded-2xl p-10 flex flex-col gap-8 overflow-hidden">
              {/* Card glow */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.07)_0%,transparent_55%)] pointer-events-none"
              />

              {/* Development badge */}
              <span className="absolute top-4 right-4 bg-dawn-gold/15 border border-dawn-gold/30 text-dawn-gold font-sans font-medium text-[11px] tracking-widest uppercase rounded-md px-2.5 py-1">
                In Development
              </span>

              {/* Label + Price */}
              <div className="relative">
                <p className="font-sans text-xs font-medium tracking-widest uppercase text-refreshing-teal mb-3">
                  Pro Tier
                </p>
                <div className="flex items-end gap-3 flex-wrap">
                  <span className="font-display font-bold text-5xl text-starlight-text leading-none">
                    Rp 0
                  </span>
                  <div className="flex flex-col pb-1 gap-0.5">
                    <span className="font-sans text-sm text-muted-text line-through">
                      Rp 49,000 / month
                    </span>
                    <span className="font-sans text-xs text-muted-text">during development</span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-clean-border relative" />

              {/* Features */}
              <ul className="relative flex flex-col gap-3">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckIcon className="text-dawn-gold shrink-0" />
                    <span className="font-sans text-sm text-muted-text">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href="/signup"
                className="relative mt-auto block text-center font-display font-bold text-sm text-midnight-sky bg-refreshing-teal rounded-xl py-3.5 hover:brightness-110 transition-all duration-200 shadow-[0_4px_20px_rgba(45,212,191,0.25)]"
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
