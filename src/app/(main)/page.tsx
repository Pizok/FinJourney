import Link from 'next/link';
import Accordion from '@/components/ui/Accordion';
import { Zap, ShieldCheck, TrendingUp, ShieldAlert, ShoppingBag, Trophy, Swords  } from 'lucide-react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/* ─────────────────────────────────────────────────────────────
   HERO
   One permitted atmospheric effect: a single centred teal glow
   at very low opacity. grid-overlay provides structural depth.
   star-field removed — absolute ban.
───────────────────────────────────────────────────────────── */

// Pre-calculated positions to maintain a balanced layout without client-side hydration mismatch
const FLOATING_CARDS = [
  { id: '1', content: 'Rp', type: 'text', size: 'w-10 h-10 md:w-16 md:h-16', top: '15%', left: '10%', delay: '0s', duration: '7s' },
  { id: '2', content: 'XP', type: 'text', size: 'w-8 h-8 md:w-12 md:h-12', top: '25%', left: '80%', delay: '1s', duration: '9s', color: 'text-dawn-gold/60' },
  { id: '3', type: 'empty', size: 'w-16 h-16 md:w-24 md:h-24', top: '55%', left: '8%', delay: '2s', duration: '10s' },
  { id: '4', content: '+1.5k', type: 'text', size: 'w-14 h-14 md:w-20 md:h-20', top: '70%', left: '85%', delay: '0.5s', duration: '8s', color: 'text-muted-emerald/60' },
  { id: '5', icon: ShieldAlert, type: 'icon', size: 'w-10 h-10 md:w-14 md:h-14', top: '10%', left: '65%', delay: '1.5s', duration: '8.5s', color: 'text-terracotta/50' },
  { id: '6', content: 'HP', type: 'text', size: 'w-10 h-10 md:w-14 md:h-14', top: '80%', left: '15%', delay: '2.5s', duration: '11s', color: 'text-muted-emerald/60' },
  { id: '7', type: 'empty', size: 'w-10 h-10 md:w-16 md:h-16', top: '45%', left: '90%', delay: '0s', duration: '7.5s' },
  { id: '8', icon: Trophy, type: 'icon', size: 'w-8 h-8 md:w-12 md:h-12', top: '35%', left: '20%', delay: '1.2s', duration: '9s', color: 'text-muted-text/40' },
  { id: '9', content: '%', type: 'text', size: 'w-8 h-8 md:w-10 md:h-10', top: '65%', left: '75%', delay: '0.8s', duration: '6s' },
];

function HeroSection() {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
      {/* Structural grid */}
      <div className="absolute inset-0 bg-black/50 pointer-events-none" aria-hidden="true" />

      {/* Floating Background Cards */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {FLOATING_CARDS.map((card) => (
          <div
            key={card.id}
            className={`absolute flex items-center justify-center rounded-xl bg-canvas-surface/60 border border-tactical-border/50 backdrop-blur-[2px] animate-float ${card.size}`}
            style={{
              top: card.top,
              left: card.left,
              animationDelay: card.delay,
              animationDuration: card.duration,
            }}
          >
            {card.type === 'text' && (
              <span className={`font-display font-bold text-xs md:text-lg ${card.color || 'text-muted-text/40'}`}>
                {card.content}
              </span>
            )}
            {card.type === 'icon' && card.icon && (
              <card.icon className={`w-1/2 h-1/2 ${card.color || 'text-muted-text/40'}`} strokeWidth={1.5} />
            )}
          </div>
        ))}
      </div>

      {/* One centred glow — hero-only */}
      <div
        aria-hidden="true"
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[440px] bg-[radial-gradient(ellipse_at_center,rgba(13,148,136,0.07)_0%,transparent_70%)] pointer-events-none z-0"
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-32 text-center flex flex-col items-center gap-6">
        {/* Badge */}
        <span className="font-display font-semibold text-xs tracking-widest uppercase text-muted-emerald">
          Financial Adventure · Free to Start
        </span>

        <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-[5rem] text-pearl-text tracking-tight leading-[1.08] max-w-3xl">
          Level Up Your{' '}
          <span className="text-muted-emerald">Financial Life</span>
        </h1>

        <p className="font-sans text-lg md:text-xl text-muted-text leading-relaxed max-w-prose">
          Stop tracking expenses blindly. Build better money habits through daily budgeting,
          visible progress, and long-term financial challenges designed to keep you consistent.
        </p>

        {/* Hero CTA */}
        <Link
          href="/auth?view=signup"
          className="font-display font-bold text-base text-abyssal-slate bg-muted-emerald rounded-lg px-10 py-4 mt-2 hover:brightness-90 transition-all duration-200 shadow-[0_4px_24px_rgba(13,148,136,0.28)]"
        >
          Start Your Journey
        </Link>

        <p className="font-sans text-sm text-muted-text max-w-prose leading-relaxed">
          Most people fail financially not because they lack knowledge — but because they stop
          paying attention after a few weeks.
        </p>

        {/* Stat section */}
        <div className="flex flex-wrap justify-center items-center gap-x-10 mt-14 px-6 relative z-10">
          {[
            { label: 'Daily Budget', sub: 'Smart spending limits', accent: 'text-muted-emerald' },
            { label: 'HP & XP', sub: 'Visible progress system', accent: 'text-dawn-gold' },
            { label: 'Quarterly', sub: 'Financial reviews', accent: 'text-pearl-text' },
          ].map((s, index, array) => (
            <div key={s.label} className="flex items-center">
              <div className="text-center py-6 flex-1 max-w-[280px]">
                <p className={`font-display font-semibold text-lg lg:text-lg tracking-tight leading-none ${s.accent}`}>
                  {s.label}
                </p>
                <p className="font-sans text-sm tracking-widest text-muted-text mt-4 uppercase">
                  {s.sub}
                </p>
              </div>

              {index < array.length - 1 && (
                <div
                  className="h-24 border-l-2 border-tactical-border/50 w-px flex-shrink-0 mx-6 lg:mx-8 hidden md:block"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   USER FLOW
   Replaced identical 3-card grid with a numbered list.
   Dividers provide rhythm without card clutter.
───────────────────────────────────────────────────────────── */
function UserFlowSection() {
  const steps = [
    {
      num: '01',
      title: 'Build Your Baseline',
      body: 'Set your monthly income, fixed expenses, and savings target. FinJourney automatically calculates a recommended daily spending limit based on your real finances.',
      accent: 'text-muted-emerald',
    },
    {
      num: '02',
      title: 'Track Daily Decisions',
      body: 'Log your spending each day and monitor how your habits affect your progress. Staying within budget strengthens your Defense Shield and keeps your journey stable.',
      accent: 'text-dawn-gold',
    },
    {
      num: '03',
      title: 'Grow Through Consistency',
      body: 'Earn XP by maintaining healthy financial habits, completing reviews, and staying disciplined over time. Unlock advanced features as your journey progresses.',
      accent: 'text-steel-violet',
    },
  ];

  return (
    <section className="relative py-16 lg:py-24 bg-transparent">
      {/* Content wrapper — needs relative and z-10 to stay visible above the overlay */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-xl mx-auto mb-20">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-pearl-text tracking-tight mb-4">
            How FinJourney Works
          </h2>
          <p className="font-sans text-base text-muted-text leading-relaxed">
            A simple system that turns financial discipline into daily progress.
          </p>
        </div>

        {/* Numbered list — dividers replace card borders */}
        <div className="max-w-3xl mx-auto divide-y divide-tactical-border">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-10 py-12 first:pt-0 last:pb-0">
              <span
                className={`font-display font-bold text-4xl tabular-nums leading-none shrink-0 w-12 ${s.accent}`}
                aria-hidden="true"
              >
                {s.num}
              </span>
              <div>
                <h3 className="font-display font-semibold text-xl text-pearl-text mb-3">
                  {s.title}
                </h3>
                <p className="font-sans text-base text-muted-text leading-relaxed max-w-prose">
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   CORE FEATURES
   Blobs removed from Card 1 and Card 2 (scattered glow ban).
   Row 2 replaced: 3 identical cards → one connected panel
   with internal dividers. No nesting.
───────────────────────────────────────────────────────────── */
function FeaturesSection() {
  return (
    <section className="py-28 lg:py-36 bg-canvas-surface/20">
      <div className="max-w-7xl mx-auto px-6">

        {/* Left-aligned header for section variety */}
        <div className="max-w-2xl mb-16">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-pearl-text tracking-tight leading-tight mb-4">
            Designed to Build Real Financial Discipline
          </h2>
          <p className="font-sans text-base text-muted-text leading-relaxed max-w-prose">
            FinJourney combines budgeting, behavioral tracking, and progression systems to help
            you stay consistent long enough to see real improvement.
          </p>
        </div>

        {/* Row 1: asymmetric 7/5 split */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-5">

          {/* Card 1 — 7 cols. Blob removed. */}
          <div className="col-span-1 md:col-span-7 bg-canvas-surface border border-tactical-border rounded-xl p-10">
            <span className="inline-block font-display font-semibold text-[11px] tracking-widest uppercase text-muted-emerald mb-6">
              Core System
            </span>
            <h3 className="font-display font-bold text-2xl text-pearl-text mb-3">
              Daily Budget & Health System
            </h3>
            <p className="font-sans text-[15px] text-muted-text leading-relaxed max-w-prose mb-8">
              Your financial behavior has visible consequences. Overspending reduces your HP,
              while disciplined spending helps maintain your progress and stability over time.
            </p>
            {/* HP / XP bars */}
            <div className="flex flex-col gap-3 max-w-sm">
              <div className="flex items-center gap-3">
                <span className="font-sans text-xs text-muted-text w-6">HP</span>
                <div className="flex-1 h-2 bg-abyssal-slate rounded-full overflow-hidden">
                  <div className="w-[72%] h-full bg-muted-emerald rounded-full" />
                </div>
                <span className="font-sans text-xs text-muted-text">72</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-sans text-xs text-muted-text w-6">XP</span>
                <div className="flex-1 h-2 bg-abyssal-slate rounded-full overflow-hidden">
                  <div className="w-[45%] h-full bg-dawn-gold rounded-full" />
                </div>
                <span className="font-sans text-xs text-muted-text">Lv 4</span>
              </div>
            </div>
          </div>

          {/* Card 2 — 5 cols. Blob removed. */}
          <div className="col-span-1 md:col-span-5 bg-canvas-surface border border-tactical-border rounded-xl p-10">
            <span className="inline-block font-display font-semibold text-[11px] tracking-widest uppercase text-dawn-gold mb-6">
              Insights
            </span>
            <h3 className="font-display font-bold text-2xl text-pearl-text mb-3">
              Smart Reviews & Recommendations
            </h3>
            <p className="font-sans text-[15px] text-muted-text leading-relaxed max-w-prose mb-6">
              FinJourney analyzes your spending behavior, savings consistency, and financial
              targets to generate practical recommendations that improve your habits month after month.
            </p>
            <ul className="flex flex-col gap-2.5">
              {[
                'Recurring overspending alerts',
                'Savings consistency tracking',
                'Category-based spending insights',
                'Behavior trend analysis',
                'Financial habit suggestions',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <svg
                    className="text-dawn-gold mt-0.5 shrink-0"
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                  >
                    <path
                      d="M2.5 7L5.5 10L11.5 4"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="font-sans text-sm text-muted-text">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Row 2: single connected panel, internal dividers — no separate cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-tactical-border border border-tactical-border rounded-xl overflow-hidden">
          {[
            {
              icon: <Zap       className="w-5 h-5 text-terracotta"   strokeWidth={2} />,
              label: 'Quarterly Financial Challenges',
              body: 'Every 3 months, FinJourney reviews your financial performance through milestone-based challenges focused on savings, spending discipline, and consistency.',
            },
            {
              icon: <ShieldCheck className="w-5 h-5 text-dawn-gold"   strokeWidth={2} />,
              label: 'Consistency Rewards',
              body: 'Finishing the day below your budget strengthens your Defense Shield and rewards you with bonus XP to encourage sustainable habits.',
            },
            {
              icon: <TrendingUp  className="w-5 h-5 text-muted-emerald" strokeWidth={2} />,
              label: 'Progression System',
              body: 'Your progress is earned through real financial behavior. Levels, rewards, and unlocks reflect consistency — not artificial grinding.',
            },
          ].map((f) => (
            <div key={f.label} className="bg-canvas-surface p-8">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-abyssal-slate border border-tactical-border mb-5">
                {f.icon}
              </div>
              <h3 className="font-display font-semibold text-lg text-pearl-text mb-2.5">
                {f.label}
              </h3>
              <p className="font-sans text-sm text-muted-text leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   HIGHLIGHT
   Background glow blob removed. Blockquote side-stripe removed
   (absolute ban). Gradient line simplified to solid token color.
   Background asset placeholder retained (renderer-driven).
───────────────────────────────────────────────────────────── */
function HighlightSection() {
  return (
    <section className="relative py-32 lg:py-40 overflow-hidden bg-abyssal-slate">
      {/* Background image layer */}
      <div
        aria-hidden="true"
        data-asset-key="highlight-background"
        className="absolute inset-0 bg-cover opacity-[100] bg-bottom pointer-events-none bg-[url('/background/landing/highlight.png')]"
      />
      
      {/* Black overlay layer */}
      <div className="absolute inset-0 bg-black/60 pointer-events-none" aria-hidden="true" />


      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        {/* Restrained accent line — solid token, no gradient */}
        <div className="w-10 h-[3px] bg-muted-emerald rounded-full mx-auto mb-10" />

        <h2 className="font-display font-bold text-4xl lg:text-[3.2rem] text-pearl-text tracking-tight leading-tight mb-6">
          Built to Change Daily Behavior
        </h2>
        <p className="font-sans text-lg text-muted-text leading-relaxed max-w-prose mx-auto mb-14">
          Good financial habits are not built from motivation alone. They are built through
          repetition, awareness, and visible progress over time.
        </p>

        {/* Blockquote — full border only, side-stripe removed */}
        <blockquote className="bg-canvas-surface/70 border border-tactical-border rounded-xl px-9 py-7 text-left">
          <p className="font-display font-medium text-lg text-pearl-text leading-relaxed italic opacity-[100]">
            "People rarely lose control of their finances in one day. It happens slowly through
            repeated small decisions — and that's exactly where FinJourney helps."
          </p>
        </blockquote>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   FAQ
───────────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    question: 'Is FinJourney difficult for beginners?',
    answer:
      'Not at all. FinJourney is designed to be simple to start. You only need to set up your primary wallet, regular expenses, and savings targets to begin your journey.',
  },
  {
    question: 'Is this a budgeting app or a game?',
    answer:
      'FinJourney is a budgeting and financial habit app first. The progression systems—like earning XP and completing challenges—exist purely to make consistency more engaging and easier to maintain.',
  },
  {
    question: 'How do the Challenges work?',
    answer:
      'Instead of generic goals, FinJourney analyzes your actual financial situation (like missed payments or lagging savings) and assigns you smart, context-aware challenges designed to strengthen your discipline exactly where you need it most.',
  },
  {
    question: 'What happens if I forget to log my transactions?',
    answer:
      'If you miss a day, you will lose HP. If your HP drops too low, your account enters Critical Failure mode and progression pauses. However, you can use a Standby Token or a Defense Shield from your inventory to protect your streak on busy days.',
  },
  {
    question: "What if I don't spend anything today?",
    answer:
      'You can easily use a Standby Token to maintain your daily streak without having to record an expense. It protects your progress when you have a zero-spend day or just need a break.',
  },
];

function FAQSection() {
  return (
    // 1. Added relative and overflow-hidden
    <section className="relative py-28 lg:py-36 overflow-hidden">
      
      {/* 2. Inserted grid overlay */}
      <div className="grid-overlay absolute inset-0 pointer-events-none opacity-100" aria-hidden="true" />

      {/* 3. Added relative z-10 to keep content on top */}
      <div className="relative z-10 max-w-2xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-pearl-text tracking-tight mb-4">
            FAQ
          </h2>
          <p className="font-sans text-base text-muted-text leading-relaxed">
            Common Questions Before You Begin
          </p>
        </div>
        <Accordion items={FAQ_ITEMS} />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   CTA
   Glow shadow removed — per DESIGN.md glow is hero-CTA only.
───────────────────────────────────────────────────────────── */
function CTASection() {
  return (
    <section className="py-28 lg:py-36 bg-canvas-surface/20">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="font-display font-bold text-4xl lg:text-5xl text-pearl-text tracking-tight leading-tight mb-6">
          Ready to Take Control of Your Financial Journey?
        </h2>
        <p className="font-sans text-lg text-muted-text leading-relaxed max-w-prose mx-auto mb-10">
          Track your spending, build better habits, and turn daily discipline into visible
          long-term progress.
        </p>

        <Link
          href="/auth?view=signup"
          className="inline-block font-display font-bold text-base text-abyssal-slate bg-muted-emerald rounded-lg px-12 py-4 hover:brightness-90 transition-all duration-200 mb-6"
        >
          Begin Your Journey
        </Link>

        <p className="font-sans text-sm text-muted-text max-w-prose mx-auto leading-relaxed">
          The small financial decisions you repeat every day eventually become the life you live.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE EXPORT
───────────────────────────────────────────────────────────── */
export default async function LandingPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <>
      <HeroSection />
      <UserFlowSection />
      <FeaturesSection />
      <HighlightSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
