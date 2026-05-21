import Link from 'next/link';
import Accordion from '@/components/Accordion';

/* ─────────────────────────────────────────────────────────────
   HERO
───────────────────────────────────────────────────────────── */
function HeroSection() {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#0D141E_0%,#0f1a26_50%,#0D141E_100%)]">
      {/* Stars */}
      <div className="star-field" aria-hidden="true" />
      {/* Subtle grid */}
      <div className="grid-overlay absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true" />
      {/* Teal radial glow */}
      <div
        aria-hidden="true"
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.07)_0%,transparent_70%)] pointer-events-none"
      />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-32 text-center flex flex-col items-center gap-6">
        {/* Badge */}
        <span className="inline-flex items-center gap-2 bg-refreshing-teal/10 border border-refreshing-teal/30 text-refreshing-teal font-sans font-medium text-xs tracking-widest rounded-full px-4 py-1.5 uppercase">
          Financial Adventure · Free to Start
        </span>

        {/* Heading */}
        <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-[5rem] text-starlight-text tracking-tight leading-[1.08] max-w-3xl">
          Level Up Your{' '}
          <span className="text-refreshing-teal">Financial Life</span>
        </h1>

        {/* Sub-heading */}
        <p className="font-sans text-lg md:text-xl text-muted-text leading-relaxed max-w-2xl">
          Stop tracking expenses blindly. Build better money habits through daily budgeting,
          visible progress, and long-term financial challenges designed to keep you consistent.
        </p>

        {/* CTA button */}
        <Link
          href="/signup"
          className="font-display font-bold text-base text-midnight-sky bg-refreshing-teal rounded-xl px-10 py-4 mt-2 hover:brightness-110 transition-all duration-200 shadow-[0_4px_24px_rgba(45,212,191,0.28)]"
        >
          Start Your Journey
        </Link>

        {/* Psychology line */}
        <p className="font-sans text-sm text-muted-text max-w-md leading-relaxed">
          Most people fail financially not because they lack knowledge — but because they stop
          paying attention after a few weeks.
        </p>

        {/* Floating stat pills */}
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          {[
            { label: 'Daily Budget',  sub: 'Smart spending limits',   accent: 'text-refreshing-teal' },
            { label: 'HP & XP',       sub: 'Visible progress system', accent: 'text-dawn-gold'       },
            { label: 'Quarterly',     sub: 'Financial reviews',       accent: 'text-coral-danger'    },
          ].map((s) => (
            <div key={s.label} className="bg-slate-canvas border border-clean-border rounded-xl px-5 py-3 text-left">
              <p className={`font-display font-semibold text-sm ${s.accent}`}>{s.label}</p>
              <p className="font-sans text-xs text-muted-text mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   USER FLOW
───────────────────────────────────────────────────────────── */
function UserFlowSection() {
  const steps = [
    {
      num: '01',
      title: 'Build Your Baseline',
      body: 'Set your monthly income, fixed expenses, and savings target. FinJourney automatically calculates a recommended daily spending limit based on your real finances.',
      bar: 'bg-refreshing-teal',
    },
    {
      num: '02',
      title: 'Track Daily Decisions',
      body: 'Log your spending each day and monitor how your habits affect your progress. Staying within budget strengthens your Defense Shield and keeps your journey stable.',
      bar: 'bg-dawn-gold',
    },
    {
      num: '03',
      title: 'Grow Through Consistency',
      body: 'Earn XP by maintaining healthy financial habits, completing reviews, and staying disciplined over time. Unlock advanced features as your journey progresses.',
      bar: 'bg-coral-danger',
    },
  ];

  return (
    <section className="py-28 lg:py-36">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center max-w-xl mx-auto mb-16">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-starlight-text tracking-tight mb-4">
            How FinJourney Works
          </h2>
          <p className="font-sans text-base text-muted-text leading-relaxed">
            A simple system that turns financial discipline into daily progress.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <div
              key={s.num}
              className="relative bg-slate-canvas border border-clean-border hover:border-refreshing-teal rounded-2xl p-8 overflow-hidden transition-colors duration-200 group"
            >
              {/* Watermark number */}
              <span
                aria-hidden="true"
                className="absolute -top-3 right-4 font-display font-bold text-[88px] leading-none text-clean-border/50 select-none pointer-events-none"
              >
                {s.num}
              </span>

              {/* Accent bar */}
              <div className={`w-9 h-1 ${s.bar} rounded-full mb-6`} />

              <h3 className="font-display font-semibold text-lg text-starlight-text mb-3">
                {s.title}
              </h3>
              <p className="font-sans text-sm text-muted-text leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   CORE FEATURES — uneven 12-col grid
───────────────────────────────────────────────────────────── */
function FeaturesSection() {
  return (
    <section className="py-28 lg:py-36 bg-slate-canvas/20">
      <div className="max-w-7xl mx-auto px-6">

        {/* Section header — left-aligned for variety */}
        <div className="max-w-2xl mb-14">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-starlight-text tracking-tight leading-tight mb-4">
            Designed to Build Real Financial Discipline
          </h2>
          <p className="font-sans text-base text-muted-text leading-relaxed">
            FinJourney combines budgeting, behavioral tracking, and progression systems to help
            you stay consistent long enough to see real improvement.
          </p>
        </div>

        {/* ── Row 1: 2 large cards ─────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-5">

          {/* Card 1 — Daily Budget & Health — 7 cols */}
          <div className="relative col-span-1 md:col-span-7 bg-slate-canvas border border-clean-border hover:border-refreshing-teal rounded-2xl p-10 overflow-hidden transition-colors duration-200 group">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.06)_0%,transparent_60%)] pointer-events-none"
            />

            <div className="relative">
              {/* Category chip */}
              <span className="inline-flex items-center gap-2 bg-refreshing-teal/10 border border-refreshing-teal/25 text-refreshing-teal font-sans font-medium text-[11px] tracking-widest uppercase rounded-md px-3 py-1 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-refreshing-teal" />
                Core System
              </span>

              <h3 className="font-display font-bold text-2xl text-starlight-text mb-3">
                Daily Budget & Health System
              </h3>
              <p className="font-sans text-[15px] text-muted-text leading-relaxed max-w-lg mb-8">
                Your financial behavior has visible consequences. Overspending reduces your HP,
                while disciplined spending helps maintain your progress and stability over time.
              </p>

              {/* HP / XP bars — decorative */}
              <div className="flex flex-col gap-3 max-w-sm">
                <div className="flex items-center gap-3">
                  <span className="font-sans text-xs text-muted-text w-6">HP</span>
                  <div className="flex-1 h-2 bg-midnight-sky rounded-full overflow-hidden">
                    <div className="w-[72%] h-full bg-refreshing-teal rounded-full" />
                  </div>
                  <span className="font-sans text-xs text-muted-text">72</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-sans text-xs text-muted-text w-6">XP</span>
                  <div className="flex-1 h-2 bg-midnight-sky rounded-full overflow-hidden">
                    <div className="w-[45%] h-full bg-dawn-gold rounded-full" />
                  </div>
                  <span className="font-sans text-xs text-muted-text">Lv 4</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 — Smart Reviews — 5 cols */}
          <div className="relative col-span-1 md:col-span-5 bg-slate-canvas border border-clean-border hover:border-dawn-gold rounded-2xl p-10 overflow-hidden transition-colors duration-200 group">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(251,191,36,0.06)_0%,transparent_60%)] pointer-events-none"
            />

            <div className="relative">
              <span className="inline-flex items-center gap-2 bg-dawn-gold/10 border border-dawn-gold/25 text-dawn-gold font-sans font-medium text-[11px] tracking-widest uppercase rounded-md px-3 py-1 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-dawn-gold" />
                Insights
              </span>

              <h3 className="font-display font-bold text-2xl text-starlight-text mb-3">
                Smart Reviews & Recommendations
              </h3>
              <p className="font-sans text-[15px] text-muted-text leading-relaxed mb-6">
                FinJourney analyzes your spending behavior, savings consistency, and financial
                targets to generate practical recommendations that help you improve month after month.
              </p>

              <ul className="flex flex-col gap-2">
                {[
                  'Recurring overspending alerts',
                  'Savings consistency tracking',
                  'Category-based spending insights',
                  'Behavior trend analysis',
                  'Financial habit suggestions',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <svg className="text-dawn-gold mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="font-sans text-sm text-muted-text">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ── Row 2: 3 medium/small cards ─────── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

          {/* Card 3 — Quarterly Challenges */}
          <div className="col-span-1 md:col-span-4 bg-slate-canvas border border-clean-border hover:border-refreshing-teal rounded-2xl p-8 transition-colors duration-200">
            <span className="text-3xl mb-5 block">⚔️</span>
            <h3 className="font-display font-semibold text-lg text-starlight-text mb-2.5">
              Quarterly Financial Challenges
            </h3>
            <p className="font-sans text-sm text-muted-text leading-relaxed">
              Every 3 months, FinJourney reviews your financial performance through milestone-based
              challenges focused on savings, spending discipline, and consistency.
            </p>
          </div>

          {/* Card 4 — Consistency Rewards */}
          <div className="col-span-1 md:col-span-4 bg-slate-canvas border border-clean-border hover:border-dawn-gold rounded-2xl p-8 transition-colors duration-200">
            <span className="text-3xl mb-5 block">🛡️</span>
            <h3 className="font-display font-semibold text-lg text-starlight-text mb-2.5">
              Consistency Rewards
            </h3>
            <p className="font-sans text-sm text-muted-text leading-relaxed">
              Finishing the day below your budget strengthens your Defense Shield and rewards you
              with bonus XP to encourage sustainable habits.
            </p>
          </div>

          {/* Card 5 — Progression System */}
          <div className="col-span-1 md:col-span-4 bg-slate-canvas border border-clean-border hover:border-refreshing-teal rounded-2xl p-8 transition-colors duration-200">
            <span className="text-3xl mb-5 block">📈</span>
            <h3 className="font-display font-semibold text-lg text-starlight-text mb-2.5">
              Progression System
            </h3>
            <p className="font-sans text-sm text-muted-text leading-relaxed">
              Your progress is earned through real financial behavior. Levels, rewards, and unlocks
              reflect consistency — not artificial grinding.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   HIGHLIGHT
───────────────────────────────────────────────────────────── */
function HighlightSection() {
  return (
    <section className="relative py-32 lg:py-40 overflow-hidden bg-midnight-sky">
      {/* Background glow */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.05)_0%,transparent_70%)] pointer-events-none"
      />
      {/* Dynamic background asset placeholder */}
      <div
        aria-hidden="true"
        data-asset-key="highlight-background"
        className="absolute inset-0 bg-cover bg-center opacity-[0.04] pointer-events-none [background-image:url(/assets/highlight-bg.webp)]"
      />

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        {/* Decorative gradient line */}
        <div className="w-10 h-[3px] bg-[linear-gradient(90deg,#2DD4BF,#FBBF24)] rounded-full mx-auto mb-10" />

        <h2 className="font-display font-bold text-4xl lg:text-[3.2rem] text-starlight-text tracking-tight leading-tight mb-6">
          Built to Change Daily Behavior
        </h2>
        <p className="font-sans text-lg text-muted-text leading-relaxed mb-14">
          Good financial habits are not built from motivation alone. They are built through
          repetition, awareness, and visible progress over time.
        </p>

        {/* Quote block */}
        <blockquote className="bg-slate-canvas border border-clean-border border-l-4 border-l-refreshing-teal rounded-2xl px-9 py-7 text-left">
          <p className="font-display font-medium text-lg text-starlight-text leading-relaxed italic">
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
      'No. FinJourney is designed to be simple to start. You only need your monthly income, regular expenses, and savings target to begin.',
  },
  {
    question: 'Is this a budgeting app or a game?',
    answer:
      'FinJourney is a budgeting and financial habit app first. The progression system exists to make consistency more engaging and easier to maintain.',
  },
  {
    question: 'How does the Daily Budget work?',
    answer:
      'Your Daily Budget is calculated using this formula: (Monthly Income − Fixed Costs − Savings Target) ÷ 30. This gives you a realistic daily spending guide based on your actual finances.',
  },
  {
    question: 'How do the recommendations work?',
    answer:
      'FinJourney analyzes your spending patterns, budget consistency, savings progress, and financial behavior over time. The system then provides suggestions and insights to help you improve your habits gradually.',
  },
  {
    question: 'What happens if my HP reaches 0?',
    answer:
      'Your account enters Critical Failure mode. Some progression features pause temporarily until you complete a quick financial review and log a new transaction to recover.',
  },
  {
    question: "What if I don't spend anything today?",
    answer:
      'You can log a "Zero Spend Today" activity to maintain your streak and confirm your daily status without recording an expense.',
  },
];

function FAQSection() {
  return (
    <section className="py-28 lg:py-36">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-starlight-text tracking-tight">
            Common Questions Before You Begin
          </h2>
        </div>
        <Accordion items={FAQ_ITEMS} />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   CTA
───────────────────────────────────────────────────────────── */
function CTASection() {
  return (
    <section className="py-28 lg:py-36 bg-slate-canvas/20">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="font-display font-bold text-4xl lg:text-5xl text-starlight-text tracking-tight leading-tight mb-6">
          Ready to Take Control of Your Financial Journey?
        </h2>
        <p className="font-sans text-lg text-muted-text leading-relaxed max-w-xl mx-auto mb-10">
          Track your spending, build better habits, and turn daily discipline into visible
          long-term progress.
        </p>

        <Link
          href="/signup"
          className="inline-block font-display font-bold text-base text-midnight-sky bg-refreshing-teal rounded-xl px-12 py-4 hover:brightness-110 transition-all duration-200 shadow-[0_4px_28px_rgba(45,212,191,0.3)] mb-6"
        >
          Begin Your Journey
        </Link>

        <p className="font-sans text-sm text-muted-text max-w-sm mx-auto leading-relaxed">
          The small financial decisions you repeat every day eventually become the life you live.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE EXPORT
───────────────────────────────────────────────────────────── */
export default function LandingPage() {
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
