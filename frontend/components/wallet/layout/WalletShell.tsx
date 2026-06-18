'use client';

// =============================================================================
// components/wallet/layout/WalletShell.tsx — FinJourney Wallet Page
//
// Top-level client layout shell. This is the only component rendered by
// the server page. Everything below it is client-side.
//
// Responsibilities:
//   1. Bootstraps the Zustand store on mount (mock data now; real API in Part 2).
//   2. Establishes the max-width 1440px, centred, gap-8 page layout.
//   3. Renders section-level skeleton loaders during the bootstrap phase.
//      Each skeleton mirrors the rough geometry of its real section so layout
//      shift is minimal on hydration.
//   4. Exposes named section containers for child components (Part 2 / 3):
//        • #section-overview     → WalletCardList
//        • #section-categories   → CategoryTrackingSection
//        • #section-transactions → TransactionTable
//
// Design rules (DESIGN.md):
//   • Flat surfaces only — no glassmorphism, no outer glows.
//   • Abyssal Slate page background (--color-abyssal-slate).
//   • Canvas Surface cards (--color-canvas-surface).
//   • gap-8 between sections, p-6 / p-8 within cards.
//   • No hardcoded hex values — CSS custom properties only.
//   • Source Sans 3 for headings, IBM Plex Sans for body.
// =============================================================================

import { useEffect } from 'react';
import { useWalletStore } from '@/components/wallet/stores/walletStore';
import { DashboardSidebar } from '@/components/dashboard/layout/DashboardSidebar';
import { WalletCardList } from '@/components/wallet/overview/WalletCardList';
import { CategoryTrackingSection } from '@/components/wallet/categories/CategoryTrackingSection';
import { TransactionTable } from '@/components/wallet/transactions/TransactionTable';
import { CreateWalletModal } from '@/components/wallet/modals/CreateWalletModal';
import { WalletSettingsModal } from '@/components/wallet/modals/WalletSettingsModal';
import { DeleteWalletModal } from '@/components/wallet/modals/DeleteWalletModal';
import { DeleteTransactionModal } from '@/components/wallet/modals/DeleteTransactionModal';
import { AddTransactionModal } from '@/components/wallet/modals/AddTransactionModal';
import { EditTransactionModal } from '@/components/wallet/modals/EditTransactionModal';

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton primitives
// ─────────────────────────────────────────────────────────────────────────────

/** Single animated placeholder block. */
function Bone({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[var(--color-tactical-border)]/40 ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section skeletons
// Each mirrors the approximate visual footprint of the real section so
// the page doesn't jump on hydration.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Overview skeleton — 1 wide total-balance card + 3 wallet cards + add button.
 */
function OverviewSkeleton() {
  return (
    <div aria-label="Loading wallet overview" aria-busy="true">
      <div className="mb-4 flex items-center justify-between">
        <Bone className="h-3.5 w-20" />
        <Bone className="h-3 w-16" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {/* Total balance — wider */}
        <div className="min-w-[260px] flex-shrink-0 rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)] p-6">
          <Bone className="mb-4 h-3 w-24" />
          <Bone className="mb-3 h-8 w-40" />
          <Bone className="h-3 w-20" />
        </div>
        {/* Wallet cards */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="min-w-[195px] flex-shrink-0 rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)] p-5"
          >
            <div className="mb-5 flex items-start justify-between">
              <Bone className="h-9 w-9 rounded-lg" />
              <Bone className="h-5 w-5 rounded-md" />
            </div>
            <Bone className="mb-2 h-6 w-32" />
            <div className="flex items-center gap-2">
              <Bone className="h-3 w-16 rounded-full" />
              <Bone className="h-3 w-16" />
            </div>
          </div>
        ))}
        {/* Add wallet placeholder */}
        <div className="flex min-w-[120px] flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-[var(--color-tactical-border)]/50 p-5">
          <Bone className="h-9 w-9 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Category skeleton — 2-column grid of 6 progress rows.
 */
function CategorySkeleton() {
  return (
    <div aria-label="Loading category spending limits" aria-busy="true">
      <div className="mb-4 flex items-center justify-between">
        <Bone className="h-3.5 w-44" />
        <Bone className="h-3 w-24" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)] p-5"
          >
            <div className="mb-3 flex items-baseline justify-between">
              <Bone className="h-3 w-28" />
              <Bone className="h-3 w-20" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--color-abyssal-slate)]">
              <Bone className="h-full rounded-full" style={{ width: `${25 + i * 13}%` } as React.CSSProperties} />
            </div>
            <Bone className="mt-2 ml-auto h-2.5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Transaction table skeleton — filter bar + 8 rows at 56px min-height.
 */
function TransactionSkeleton() {
  return (
    <div aria-label="Loading transaction history" aria-busy="true">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Bone className="h-3.5 w-40" />
        <Bone className="h-9 w-36 rounded-lg" />
      </div>
      {/* Filter bar */}
      <div className="mb-5 flex flex-wrap gap-3">
        <Bone className="h-9 flex-1 rounded-lg" style={{ minWidth: '180px' } as React.CSSProperties} />
        {[120, 144, 128, 112].map((w, i) => (
          <Bone key={i} className="h-9 rounded-lg flex-shrink-0" style={{ width: `${w}px` } as React.CSSProperties} />
        ))}
      </div>
      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)]">
        {/* Column headers */}
        <div className="grid grid-cols-[140px_80px_1fr_110px_120px_110px] gap-4 border-b border-[var(--color-tactical-border)] px-5 py-3">
          {['Date', 'Type', 'Amount', 'Wallet', 'Category', 'Method'].map((col) => (
            <Bone key={col} className="h-3 w-14" />
          ))}
        </div>
        {/* Rows — 56px minimum height */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid min-h-[56px] grid-cols-[140px_80px_1fr_110px_120px_110px] items-center gap-4 border-b border-[var(--color-tactical-border)]/40 px-5 last:border-b-0"
          >
            <div className="flex flex-col gap-1.5">
              <Bone className="h-3 w-24" />
              <Bone className="h-2.5 w-16" />
            </div>
            <Bone className="h-5 w-16 rounded-md" />
            <div className="flex flex-col items-end gap-1.5">
              <Bone className="h-4 w-28" />
            </div>
            <Bone className="h-5 w-20 rounded-full" />
            <Bone className="h-3 w-24" />
            <Bone className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <Bone className="h-3 w-48" />
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Bone key={i} className="h-8 w-8 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Error banner
// ─────────────────────────────────────────────────────────────────────────────

function ErrorBanner({
  message,
  onRetry,
  onDismiss,
}: {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-terracotta)]/30 bg-[var(--color-terracotta)]/8 px-5 py-3.5"
    >
      <p
        className="text-sm text-[var(--color-terracotta)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {message}
      </p>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-medium text-[var(--color-terracotta)] underline-offset-2 hover:underline focus-visible:outline-none"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="text-[var(--color-terracotta)]/60 transition-colors hover:text-[var(--color-terracotta)] focus-visible:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page header
// ─────────────────────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <header>
      <h1
        className="font-display text-2xl font-semibold tracking-tight text-[var(--color-pearl-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Wallet
      </h1>
      <p
        className="mt-1 text-sm text-[var(--color-muted-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        Balances, spending limits, and transaction history.
      </p>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WalletShell — main export
// ─────────────────────────────────────────────────────────────────────────────

export function WalletShell() {
  const {
    isBootstrapped,
    loading,
    ui,
    hydrateMock,
    setGlobalError,
    setLoading,
  } = useWalletStore();

  // ── Bootstrap on mount ──────────────────────────────────────────────────
  //
  // Part 1 (now): loads mock data after a short delay so skeleton states
  // are testable and visible during local development.
  //
  // Part 2 (when real API is ready):
  //   Replace the mock call with:
  //     const res  = await fetch('/api/v1/wallet/bootstrap');
  //     const json = await res.json();
  //     hydrate(json.data);
  //
  // The `initialData` prop pattern (server → client hydration) is already
  // drafted in the server page component below. Once that fetch is
  // uncommented, WalletShell should accept an `initialData` prop and call
  // hydrate(initialData) instead of hydrateMock().
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isBootstrapped) return;

    setLoading('bootstrap', true);

    // Simulated async delay — remove when using real data.
    const timer = window.setTimeout(() => {
      try {
        hydrateMock();
      } catch {
        setGlobalError(
          'Could not load wallet data. Check your connection and try again.',
        );
      } finally {
        setLoading('bootstrap', false);
      }
    }, 550);

    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBootstrapped]);

  const isLoading = loading.bootstrap || !isBootstrapped;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
    <div className="flex min-h-screen bg-[var(--color-abyssal-slate)]">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto w-full" style={{ fontFamily: 'var(--font-sans)' }}>
      {/*
       * Content column — max-width 1440px, centred, responsive horizontal
       * padding (px-4 → px-6 → px-8 as the viewport grows).
       */}
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">

        {/*
         * Vertical stack — gap-8 between every top-level section.
         * Per wallet_prd.md § 3: "Container: gap-8 vertical spacing."
         */}
        <div className="flex flex-col gap-8">

          {/* Page header ─────────────────────────────────────────────────── */}
          <PageHeader />

          {/* Global error banner ─────────────────────────────────────────── */}
          {ui.globalError && (
            <ErrorBanner
              message={ui.globalError}
              onDismiss={() => setGlobalError(null)}
              onRetry={() => {
                setGlobalError(null);
                // Re-trigger bootstrap. Replace with real fetch in Part 2.
                hydrateMock();
              }}
            />
          )}

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION 1 — Wallet Overview                                     */}
          {/*                                                                 */}
          {/* Slot for: <WalletCardList /> (built in Part 2)                  */}
          {/* Shows: TotalBalanceCard + individual WalletCards + Add button.  */}
          {/* Interaction: click-to-filter, wallet settings menu.             */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <div
            id="section-overview"
            data-section="wallet-overview"
            aria-label="Wallet overview"
          >
            {isLoading ? (
              <OverviewSkeleton />
            ) : (
              <WalletCardList />
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION 2 — Category Tracking                                   */}
          {/*                                                                 */}
          {/* Slot for: <CategoryTrackingSection /> (built in Part 2)         */}
          {/* Shows: "Category Spending Limits" + progress bar grid.         */}
          {/* Filters to activeWallet.visible_category_ids when selected.    */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <div
            id="section-categories"
            data-section="category-tracking"
            aria-label="Category spending limits"
          >
            {isLoading ? (
              <CategorySkeleton />
            ) : (
              <CategoryTrackingSection />
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION 3 — Transaction History                                 */}
          {/*                                                                 */}
          {/* Slot for: <TransactionTable /> (built in Part 3)                */}
          {/* Shows: filter bar + paginated ledger + pagination controls.    */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <div
            id="section-transactions"
            data-section="transaction-history"
            aria-label="Transaction history"
          >
            {isLoading ? (
              <TransactionSkeleton />
            ) : (
              <TransactionTable />
            )}
          </div>

          {/* Breathing room at the bottom of the page */}
          <div className="h-8" aria-hidden="true" />

        </div>
      </div>
      </main>
    </div>

      {/* ── Modal Layer ─────────────────────────────────────────────────── */}
      {/* Each modal reads its own open/close state from the Zustand store. */}
      {/* Only one modal is ever visible at a time (managed by store flags). */}
      <AddTransactionModal />
      <EditTransactionModal />
      <CreateWalletModal />
      <WalletSettingsModal />
      <DeleteWalletModal />
      <DeleteTransactionModal />
      {/*
       * OverdraftWarningModal and CapacityWarningModal are prop-controlled
       * (not store-driven) and must be rendered by the specific parent flow
       * that needs them (e.g., AddTransactionModal, WalletCardList).
       * Do NOT render them here — they require required props.
       */}
    </>
  );
}
