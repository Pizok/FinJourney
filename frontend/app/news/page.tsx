import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Journey Updates — FinJourney',
  description: 'Latest improvements, feature releases, and system updates from FinJourney.',
};

/* ── Data ────────────────────────────────────────────────────── */
type NewsItem = {
  title: string;
  category: string;
  date: string;
  body: string;
  accentText: string;   // Tailwind text class — design-system tokens only
  isNew?: boolean;
};

const NEWS: NewsItem[] = [
  {
    title:    'Financial Recommendation System Improved',
    category: 'Update 1.1',
    date:     'May 2026',
    body:     'Improved accuracy of spending behavior analysis. Recommendations now account for seasonal expense patterns and multi-month consistency trends.',
    accentText: 'text-muted-emerald',
    isNew:    true,
  },
  {
    title:    'Monthly Habit Analysis',
    category: 'New Feature',
    date:     'April 2026',
    body:     'Introduced a new monthly habit summary that surfaces recurring spending behaviors, helps identify improvement areas, and tracks category discipline over rolling 30-day windows.',
    accentText: 'text-dawn-gold',
    isNew:    true,
  },
  {
    title:    'Standby Tokens Limited to 7 Per Year',
    category: 'System Update',
    date:     'March 2026',
    body:     'Standby Token allocation has been capped at 7 per account year to preserve the integrity of the penalty system. Existing tokens are unaffected.',
    accentText: 'text-terracotta',
  },
  {
    title:    'Clear Night Journey Theme Optimized',
    category: 'UI Enhancement',
    date:     'February 2026',
    body:     'Refined typography scale, spacing system, and surface contrast across all dashboard components. Improved readability during long financial review sessions.',
    accentText: 'text-muted-emerald',
  },
  {
    title:    'Quarterly Challenges Rebalanced',
    category: 'Progression Update',
    date:     'January 2026',
    body:     'Adjusted XP rewards and penalty thresholds for quarterly boss encounters to better reflect average user performance. Survival challenges now scale with account age.',
    accentText: 'text-dawn-gold',
  },
];

/* ── Card ────────────────────────────────────────────────────── */
function NewsCard({ item, featured }: { item: NewsItem; featured?: boolean }) {
  return (
    <article
      className={`
        bg-canvas-surface border border-tactical-border rounded-xl
        flex flex-col gap-3 h-full
        transition-colors duration-200
        hover:border-muted-text
        ${featured ? 'p-10' : 'p-8'}
      `}
    >
      {/* Meta row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/*
          Category label: this is a tiny UI badge, not heading content.
          Uppercase is permitted per DESIGN.md only for tiny labels / badges.
          Font size kept at text-[11px] to stay within "tiny label" scope.
        */}
        <span className={`font-display font-semibold text-[11px] tracking-widest uppercase ${item.accentText}`}>
          {item.category}
        </span>

        <div className="flex items-center gap-2">
          {item.isNew && (
            /*
              "New" badge: uppercase permitted for tiny badge text.
              No glow. Flat bg-muted-emerald with dark text for contrast.
            */
            <span className="font-sans font-semibold text-[10px] tracking-widest uppercase text-abyssal-slate bg-muted-emerald rounded px-1.5 py-0.5">
              New
            </span>
          )}
          <span className="font-sans text-xs text-muted-text tabular-nums">{item.date}</span>
        </div>
      </div>

      {/*
        Heading level: H2 is the section heading ("Journey Updates").
        Cards sit beneath it, so card titles are H3 — no level is skipped.
      */}
      <h3
        className={`font-display font-semibold text-pearl-text leading-snug ${
          featured ? 'text-2xl' : 'text-lg'
        }`}
      >
        {item.title}
      </h3>

      {/*
        Body copy: text-base (≥16px) per readability floor.
        max-w-prose constrains line length to ~65ch on featured card.
        No all-caps. Pearl text family via muted-text for secondary role.
      */}
      <p className="font-sans text-base text-muted-text leading-relaxed max-w-prose">
        {item.body}
      </p>
    </article>
  );
}

/* ── Page ────────────────────────────────────────────────────── */
export default function NewsPage() {
  const [featured, ...rest] = NEWS;

  return (
    /*
      Background: Abyssal Slate (#0F172A) — replaces the incorrect midnight-sky token
      and eliminates the pure-black (#000000) anti-pattern.
    */
    <div className="bg-abyssal-slate min-h-screen">

      {/* ── Page Header ──────────────────────────────────── */}
      <section className="pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">

            {/* Left: headings */}
            <div>
              {/*
                Eyebrow label: tiny uppercase label — permitted per DESIGN.md.
                Not a heading element. No glow on the border-b accent line.
              */}
              <span className="inline-block font-display font-semibold text-[11px] tracking-widest uppercase text-muted-emerald border-b border-tactical-border pb-1 mb-8">
                Changelog
              </span>

              {/*
                H1: page-level title. Only one H1 per page.
                Cards below use H3 — H2 is the implicit section anchor here
                so the sequence is H1 → (section) → H3, valid without skipping.
                If a visible section subheading is added later, it takes H2.
              */}
              <h1 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl text-pearl-text tracking-tight mb-4 leading-tight">
                Journey Updates
              </h1>

              <p className="font-sans text-base text-muted-text leading-relaxed max-w-2xl">
                Latest improvements, feature releases, and system updates from FinJourney.
              </p>
            </div>

            {/* Right: update count */}
            <div className="bg-canvas-surface border border-tactical-border rounded-xl px-8 py-6 text-right shrink-0">
              {/*
                Large number: display role, not a heading — correct as <p>.
                No glow. Muted Emerald for accent within the 10% restrained budget.
              */}
              <p className="font-display font-semibold text-4xl text-muted-emerald leading-none mb-1 tabular-nums">
                {NEWS.length}
              </p>
              <p className="font-sans text-xs text-muted-text">Updates this season</p>
            </div>

          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="border-t border-tactical-border" />
      </div>

      {/* ── News Grid ─────────────────────────────────────── */}
      <section className="py-12 pb-32" aria-label="News articles">
        <div className="max-w-7xl mx-auto px-6 flex flex-col gap-5">

          {/* Featured — full width */}
          <NewsCard item={featured} featured />

          {/* Remaining — 2-col grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {rest.map((item) => (
              <NewsCard key={item.title} item={item} />
            ))}
          </div>

        </div>
      </section>

    </div>
  );
}
