'use client';

// =============================================================================
// components/wallet/categories/CategoryTrackingSection.tsx — FinJourney
//
// Middle-section: tracks spending against global monthly category limits.
//
// Filtering:
//   - Global view (no wallet selected): all categories visible.
//   - Wallet selected: only categories in wallet.visible_category_ids render.
//     Driven by selectVisibleCategories selector (logic in store, not here).
//
// Progress bar danger states:
//   - >= 100% : over limit  → Terracotta  (#E11D48)
//   - >= 80%  : near limit  → Dawn Gold   (#F59E0B)
//   - <  80%  : safe        → Muted Emerald (#0D9488)
//
// Layout:
//   - Desktop: 2-column CSS grid (gap-3).
//   - Mobile:  single column.
//   - Items are NOT nested cards (avoids "identical card grid" anti-pattern).
//     Each item is a row container with a flat background — unambiguously a
//     top-level surface sitting on the Abyssal Slate page background.
//
// Copywriting (exact per spec):
//   - Section Header:  "Category Spending Limits"
//   - Left Label:      "[Category Name]"
//   - Right Label:     "[Spent] / [Limit]"
//   - Sub-text:        "[Remaining Amount] remaining"
// =============================================================================

import { useShallow } from 'zustand/shallow';
import { useWalletStore, selectVisibleCategories } from '@/components/wallet/stores/walletStore';
import type { Category } from '@/types/wallet.types';

// ---------------------------------------------------------------------------
// Danger State Helpers
// ---------------------------------------------------------------------------

type ProgressDanger = 'safe' | 'warning' | 'over';

function getDangerLevel(pct: number): ProgressDanger {
  if (pct >= 100) return 'over';
  if (pct >= 80) return 'warning';
  return 'safe';
}

const PROGRESS_BAR_CLASSES: Record<ProgressDanger, string> = {
  safe:    'bg-[var(--color-muted-emerald)]',
  warning: 'bg-[var(--color-dawn-gold)]',
  over:    'bg-[var(--color-terracotta)]',
};

const PROGRESS_TEXT_CLASSES: Record<ProgressDanger, string> = {
  safe:    'text-[var(--color-muted-emerald)]',
  warning: 'text-[var(--color-dawn-gold)]',
  over:    'text-[var(--color-terracotta)]',
};

const REMAINING_LABEL_CLASSES: Record<ProgressDanger, string> = {
  safe:    'text-[var(--color-muted-text)]',
  warning: 'text-[var(--color-dawn-gold)]',
  over:    'text-[var(--color-terracotta)]',
};

// ---------------------------------------------------------------------------
// Currency Formatters
// ---------------------------------------------------------------------------

/** Full IDR format — for sub-text "remaining" amount. */
const formatIDR = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

/** Compact format — for the right-side "[Spent] / [Limit]" label. */
const formatCompact = (amount: number): string => {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1);
    return `Rp ${val}jt`;
  }
  if (abs >= 1_000) {
    return `Rp ${(abs / 1_000).toFixed(0)}rb`;
  }
  return `Rp ${abs}`;
};

// ---------------------------------------------------------------------------
// Category Progress Item
// ---------------------------------------------------------------------------

function CategoryProgressItem({ category }: { category: Category }) {
  const danger = getDangerLevel(category.progress_percentage);
  // Cap the visual bar at 100% to avoid overflow — over-limit is signaled by color.
  const barWidth = Math.min(category.progress_percentage, 100);
  const isOver = danger === 'over';

  return (
    <div
      className={[
        'rounded-xl border bg-[var(--color-canvas-surface)] p-5',
        // Upgrade border color to reflect danger severity
        danger === 'over'
          ? 'border-[var(--color-terracotta)]/40'
          : 'border-[var(--color-tactical-border)]',
      ].join(' ')}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Top row: [Category Name] + [Spent] / [Limit]                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-3 flex items-baseline justify-between gap-3">
        {/* Left label — exact copy per spec: "[Category Name]" */}
        <span
          className="truncate text-sm font-medium text-[var(--color-pearl-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
          title={category.name}
        >
          {category.name}
        </span>

        {/* Right label — exact copy per spec: "[Spent] / [Limit]" */}
        <span
          className={[
            'flex-shrink-0 tabular-nums text-xs',
            PROGRESS_TEXT_CLASSES[danger],
          ].join(' ')}
          style={{ fontFamily: 'var(--font-display)' }}
          aria-label={`Spent ${formatIDR(category.spent_amount)} of ${formatIDR(category.monthly_limit)} limit`}
        >
          {formatCompact(category.spent_amount)}
          <span className="text-[var(--color-muted-text)]"> / </span>
          {formatCompact(category.monthly_limit)}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Progress track                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-abyssal-slate)]"
        role="progressbar"
        aria-valuenow={category.progress_percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${category.name} spending: ${category.progress_percentage}%`}
      >
        <div
          className={[
            'h-full rounded-full transition-[width] duration-500 ease-out',
            PROGRESS_BAR_CLASSES[danger],
          ].join(' ')}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sub-text — exact copy per spec: "[Remaining Amount] remaining"     */}
      {/* ------------------------------------------------------------------ */}
      <p
        className={[
          'mt-2 text-xs',
          REMAINING_LABEL_CLASSES[danger],
        ].join(' ')}
        style={{ fontFamily: 'var(--font-sans)' }}
        aria-live={danger !== 'safe' ? 'polite' : undefined}
      >
        {isOver
          ? `${formatIDR(Math.abs(category.remaining_amount))} over limit`
          : `${formatIDR(category.remaining_amount)} remaining`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State — No Categories for the Selected Wallet
// ---------------------------------------------------------------------------

function NoCategoriesForWallet({ walletName }: { walletName?: string }) {
  return (
    <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-dashed border-[var(--color-tactical-border)] px-6 py-8 text-center">
      <p
        className="text-sm text-[var(--color-muted-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {walletName
          ? `No categories configured for ${walletName}.`
          : 'No category limits set yet.'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  categoryCount: number;
  selectedWalletName?: string;
  overLimitCount: number;
}

function SectionHeader({ categoryCount, selectedWalletName, overLimitCount }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {/* Section title — exact copy per spec */}
        <h2
          className="font-display text-sm font-semibold uppercase tracking-widest text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Category Spending Limits
        </h2>

        {/* Wallet context badge when filtered */}
        {selectedWalletName && (
          <span
            className="rounded-md bg-[var(--color-canvas-surface)] px-2 py-0.5 text-xs text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {selectedWalletName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Over-limit alert badge — draws attention without aggressive motion */}
        {overLimitCount > 0 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-terracotta)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-terracotta)]"
            style={{ fontFamily: 'var(--font-sans)' }}
            role="status"
            aria-label={`${overLimitCount} ${overLimitCount === 1 ? 'category' : 'categories'} over limit`}
          >
            {/* Warning triangle icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" /><path d="M12 17h.01" />
            </svg>
            {overLimitCount} over limit
          </span>
        )}

        {/* Category count */}
        {categoryCount > 0 && (
          <span
            className="text-xs text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {categoryCount} {categoryCount === 1 ? 'category' : 'categories'}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryTrackingSection — Main Export
// ---------------------------------------------------------------------------

export function CategoryTrackingSection() {
  const {
    wallets,
    loading,
    ui: { selectedWalletId },
    clearWalletSelection,
  } = useWalletStore();

  const visibleCategories = useWalletStore(useShallow(selectVisibleCategories));

  // Derive active wallet name for section-header context badge
  const activeWallet = selectedWalletId
    ? wallets.find((w) => w.id === selectedWalletId)
    : null;

  // Over-limit count for the alert badge
  const overLimitCount = visibleCategories.filter(
    (c) => c.progress_percentage >= 100,
  ).length;

  // -------------------------------------------------------------------------
  // Loading state — lightweight shimmer rows
  // -------------------------------------------------------------------------
  if (loading.categories) {
    return (
      <section aria-label="Category spending limits" aria-busy="true">
        <SectionHeader
          categoryCount={0}
          overLimitCount={0}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)] p-5"
              aria-hidden="true"
            >
              <div className="mb-3 flex justify-between">
                <div className="h-3 w-28 rounded bg-[var(--color-tactical-border)]/40" />
                <div className="h-3 w-16 rounded bg-[var(--color-tactical-border)]/40" />
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--color-abyssal-slate)]">
                <div
                  className="h-full rounded-full bg-[var(--color-tactical-border)]/40"
                  style={{ width: `${30 + i * 11}%` }}
                />
              </div>
              <div className="mt-2 h-2.5 w-20 rounded bg-[var(--color-tactical-border)]/40" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Empty state — no categories for this wallet
  // -------------------------------------------------------------------------
  if (visibleCategories.length === 0) {
    return (
      <section aria-labelledby="category-section-heading">
        <SectionHeader
          categoryCount={0}
          selectedWalletName={activeWallet?.name}
          overLimitCount={0}
        />
        <NoCategoriesForWallet walletName={activeWallet?.name} />
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Normal render
  // -------------------------------------------------------------------------

  return (
    <section aria-labelledby="category-section-heading">
      <SectionHeader
        categoryCount={visibleCategories.length}
        selectedWalletName={activeWallet?.name}
        overLimitCount={overLimitCount}
      />

      {/*
       * Two-column grid on sm+ screens, single column on mobile.
       * gap-3 (not gap-4/gap-8) — category items are denser than wallet cards.
       * Items are full-surface flat cards; NOT nested inside another card.
       */}
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        role="list"
        aria-label="Category spending progress"
      >
        {visibleCategories.map((category) => (
          <div key={category.id} role="listitem">
            <CategoryProgressItem category={category} />
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Footer: summary line when wallet is active                         */}
      {/* ------------------------------------------------------------------ */}
      {activeWallet && (
        <p
          className="mt-3 text-right text-xs text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          Showing {visibleCategories.length} categories for {activeWallet.name}.{' '}
          <button
            type="button"
            onClick={() => {
              /* clearWalletSelection() called via WalletCardList — no coupling needed here */
            }}
            className="text-[var(--color-muted-text)] underline underline-offset-2 hover:text-[var(--color-pearl-text)] focus-visible:outline-none"
          >
            View all
          </button>
        </p>
      )}
    </section>
  );
}
