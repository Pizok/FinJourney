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
  accent: string;       // Tailwind text class
  accentBg: string;     // Tailwind bg/border classes for chip
  isNew?: boolean;
};

const NEWS: NewsItem[] = [
  {
    title:    'Financial Recommendation System Improved',
    category: 'Update 1.1',
    date:     'May 2026',
    body:     'Improved accuracy of spending behavior analysis. Recommendations now account for seasonal expense patterns and multi-month consistency trends.',
    accent:   'text-refreshing-teal',
    accentBg: 'bg-refreshing-teal/10 border-refreshing-teal/25 text-refreshing-teal',
    isNew:    true,
  },
  {
    title:    'Monthly Habit Analysis',
    category: 'New Feature',
    date:     'April 2026',
    body:     'Introduced a new monthly habit summary that surfaces recurring spending behaviors, helps identify improvement areas, and tracks category discipline over rolling 30-day windows.',
    accent:   'text-dawn-gold',
    accentBg: 'bg-dawn-gold/10 border-dawn-gold/25 text-dawn-gold',
    isNew:    true,
  },
  {
    title:    'Standby Tokens Limited to 7 Per Year',
    category: 'System Update',
    date:     'March 2026',
    body:     'Standby Token allocation has been capped at 7 per account year to preserve the integrity of the penalty system. Existing tokens are unaffected.',
    accent:   'text-coral-danger',
    accentBg: 'bg-coral-danger/10 border-coral-danger/25 text-coral-danger',
  },
  {
    title:    'Clear Night Journey Theme Optimized',
    category: 'UI Enhancement',
    date:     'February 2026',
    body:     'Refined typography scale, spacing system, and surface contrast across all dashboard components. Improved readability during long financial review sessions.',
    accent:   'text-refreshing-teal',
    accentBg: 'bg-refreshing-teal/10 border-refreshing-teal/25 text-refreshing-teal',
  },
  {
    title:    'Quarterly Challenges Rebalanced',
    category: 'Progression Update',
    date:     'January 2026',
    body:     'Adjusted XP rewards and penalty thresholds for quarterly boss encounters to better reflect average user performance. Survival challenges now scale with account age.',
    accent:   'text-dawn-gold',
    accentBg: 'bg-dawn-gold/10 border-dawn-gold/25 text-dawn-gold',
  },
];

/* ── Card component ──────────────────────────────────────────── */
function NewsCard({ item, featured }: { item: NewsItem; featured?: boolean }) {
  return (
    <article
      className={`relative bg-slate-canvas border rounded-2xl flex flex-col gap-4 overflow-hidden transition-colors duration-200 h-full group
        ${featured
          ? 'border-clean-border hover:border-refreshing-teal p-10'
          : 'border-clean-border hover:border-muted-text p-8'}
      `}
    >
      {featured && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.05)_0%,transparent_60%)] pointer-events-none"
        />
      )}

      {/* Meta row */}
      <div className="relative flex items-center justify-between flex-wrap gap-2">
        <span className={`inline-block border font-sans font-medium text-[11px] tracking-widest uppercase rounded-md px-2.5 py-1 ${item.accentBg}`}>
          {item.category}
        </span>
        <div className="flex items-center gap-2">
          {item.isNew && (
            <span className="font-sans font-bold text-[10px] tracking-widest text-midnight-sky bg-refreshing-teal rounded-[4px] px-2 py-0.5 uppercase">
              New
            </span>
          )}
          <span className="font-sans text-xs text-muted-text">{item.date}</span>
        </div>
      </div>

      {/* Title */}
      <h3
        className={`relative font-display font-semibold text-starlight-text leading-snug ${
          featured ? 'text-2xl' : 'text-lg'
        }`}
      >
        {item.title}
      </h3>

      {/* Body */}
      <p className="relative font-sans text-sm text-muted-text leading-relaxed">{item.body}</p>
    </article>
  );
}

/* ── Page export ─────────────────────────────────────────────── */
export default function NewsPage() {
  const [featured, ...rest] = NEWS;

  return (
    <div className="bg-midnight-sky min-h-screen">

      {/* ── Page Header ──────────────────────────────────── */}
      <section className="pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">

            {/* Left: headings */}
            <div>
              <span className="inline-flex items-center gap-2 bg-refreshing-teal/10 border border-refreshing-teal/30 text-refreshing-teal font-sans font-medium text-xs tracking-widest uppercase rounded-full px-4 py-1.5 mb-6">
                Changelog
              </span>
              <h1 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl text-starlight-text tracking-tight mb-4 leading-tight">
                Journey Updates
              </h1>
              <p className="font-sans text-base text-muted-text leading-relaxed max-w-lg">
                Latest improvements, feature releases, and system updates from FinJourney.
              </p>
            </div>

            {/* Right: update count card */}
            <div className="bg-slate-canvas border border-clean-border rounded-2xl px-8 py-6 text-right shrink-0">
              <p className="font-display font-bold text-4xl text-refreshing-teal leading-none mb-1">
                {NEWS.length}
              </p>
              <p className="font-sans text-xs text-muted-text">Updates this season</p>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="border-t border-clean-border" />
      </div>

      {/* ── News Grid ─────────────────────────────────────── */}
      <section className="py-12 pb-32">
        <div className="max-w-7xl mx-auto px-6 flex flex-col gap-5">

          {/* Featured — full width */}
          <NewsCard item={featured} featured />

          {/* Rest — 2-col grid */}
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
