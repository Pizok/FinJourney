'use client';

// =============================================================================
// components/wallet/layout/WalletShell.tsx — FinJourney Wallet Page
//
// Top-level client layout shell. This is the only component rendered by
// the server page. Everything below it is client-side.
//
// Responsibilities:
//   1. Bootstraps the Zustand store on mount (mock data now; real API in Part 2).
//   2. Wraps the page content in a two-tab layout:
//        • Ledger (default) — liquid wallets, category tracking, transactions
//        • Baselines & Debt — financial assumptions, fixed expenses, active loans
//   3. The Ledger tab uses Radix forceMount so the Zustand filter/pagination
//      state is NEVER reset when switching to the Baselines tab.
//   4. Renders section-level skeleton loaders during the bootstrap phase.
//
// Sticky Tabs note:
//   The TabsList uses sticky top-0. The PageHeader is NOT sticky — it scrolls
//   away as the user scrolls down, and the tab strip pins to the top of the
//   main scroll container. No offset compensation needed.
//
// Design rules (DESIGN.md):
//   • Flat surfaces only — no glassmorphism, no outer glows.
//   • Abyssal Slate page background (--color-abyssal-slate).
//   • Canvas Surface cards (--color-canvas-surface).
//   • gap-8 between sections, p-6 / p-8 within cards.
//   • No hardcoded hex values — CSS custom properties only.
// =============================================================================

import { useEffect } from 'react';
import { useWalletStore } from '@/components/finance/stores/walletStore';
import { DashboardSidebar } from '@/components/dashboard/layout/DashboardSidebar';
import { WalletCardList } from '@/components/finance/overview/WalletCardList';
import { WalletEmptyState } from './WalletEmptyState';
import { CategoryTrackingSection } from '@/components/finance/categories/CategoryTrackingSection';
import { TransactionTable } from '@/components/finance/transactions/TransactionTable';
import { CreateWalletModal } from '@/components/finance/modals/CreateWalletModal';
import { WalletSettingsModal } from '@/components/finance/modals/WalletSettingsModal';
import { DeleteWalletModal } from '@/components/finance/modals/DeleteWalletModal';
import { DeleteTransactionModal } from '@/components/finance/modals/DeleteTransactionModal';
import { AddTransactionModal } from '@/components/finance/modals/AddTransactionModal';
import { EditTransactionModal } from '@/components/finance/modals/EditTransactionModal';
import { BaselinesTab } from '@/components/finance/baselines/BaselinesTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

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

/**
 * Baselines tab skeleton — three stacked cards.
 */
function BaselinesSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading baselines" aria-busy="true">
      {/* FinancialAssumptionsCard skeleton */}
      <div className="rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)] p-6">
        <Bone className="mb-5 h-4 w-48" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <Bone className="mb-2 h-3 w-40" />
            <Bone className="h-10 w-full rounded-lg" />
          </div>
          <div>
            <Bone className="mb-2 h-3 w-44" />
            <Bone className="h-10 w-full rounded-lg" />
          </div>
        </div>
        <Bone className="mt-5 h-16 w-full rounded-lg" />
      </div>
      {/* FixedExpenses skeleton */}
      <div className="rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)] p-6">
        <Bone className="mb-5 h-4 w-36" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Bone className="h-9 w-9 rounded-lg" />
            <div className="flex-1">
              <Bone className="mb-1.5 h-3 w-32" />
              <Bone className="h-2.5 w-24" />
            </div>
            <Bone className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* ActiveLoans skeleton */}
      <div className="rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)] p-6">
        <Bone className="mb-5 h-4 w-32" />
        {[0, 1].map((i) => (
          <div key={i} className="py-4">
            <div className="mb-2 flex justify-between">
              <div>
                <Bone className="mb-1.5 h-3 w-40" />
                <Bone className="h-2.5 w-28" />
              </div>
              <div className="text-right">
                <Bone className="mb-1 h-4 w-28" />
                <Bone className="h-2.5 w-16" />
              </div>
            </div>
            <Bone className="h-[5px] w-full rounded-full" />
            <Bone className="mt-2 h-2.5 w-full" />
          </div>
        ))}
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
        Finance
      </h1>
      <p
        className="mt-1 text-sm text-[var(--color-muted-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        Manage balances, transactions, budgets, and financial obligations.
      </p>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WalletShell — main export
// ─────────────────────────────────────────────────────────────────────────────

import type { WalletBootstrapResponse } from '@/components/finance/types/wallet.types';

export function WalletShell({ initialData }: { initialData?: WalletBootstrapResponse | null }) {
  const {
    isBootstrapped,
    loading,
    ui,
    hydrate,
    setGlobalError,
    setLoading,
    data,
  } = useWalletStore();

  // ── Bootstrap on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (isBootstrapped) return;

    setLoading('bootstrap', true);

    if (initialData) {
      hydrate(initialData);
      setLoading('bootstrap', false);
    } else {
      // If initialData is missing (e.g. server error), set global error
      setGlobalError(
        'Could not load wallet data. Check your connection and try again.',
      );
      setLoading('bootstrap', false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isBootstrapped]);

  const isLoading = loading.bootstrap || !isBootstrapped;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
    <div className="flex min-h-screen bg-[var(--color-abyssal-slate)]">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto w-full" style={{ fontFamily: 'var(--font-sans)' }}>
        <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6">

            {/* Page header ─────────────────────────────────────────────────── */}
            <PageHeader />

            {/* Global error banner ─────────────────────────────────────────── */}
            {ui.globalError && (
              <ErrorBanner
                message={ui.globalError}
                onDismiss={() => setGlobalError(null)}
                onRetry={() => {
                  setGlobalError(null);
                  window.location.reload();
                }}
              />
            )}

            {/* ─── Tab layout ────────────────────────────────────────────── */}
            <Tabs defaultValue="ledger" className="w-full">

              {/*
               * TabsList — sticky within the main scroll container.
               * The PageHeader is NOT sticky, so it scrolls away naturally.
               * The tab strip then pins to top-0 of the scroll viewport.
               * bg-[var(--color-abyssal-slate)] prevents content bleed-through.
               */}
              <div className="sticky top-0 z-10 bg-[var(--color-abyssal-slate)] -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                <TabsList>
                  <TabsTrigger value="ledger">Ledger</TabsTrigger>
                  <TabsTrigger value="baselines">Baselines &amp; Debt</TabsTrigger>
                </TabsList>
              </div>

              {/*
               * TAB 1 — Ledger (existing content, preserved exactly)
               *
               * forceMount keeps this tab permanently mounted so the Zustand
               * filter state, selected wallet, and pagination page are never
               * reset when the user switches to Baselines & Debt and back.
               * The TabsContent's data-[state=inactive]:hidden class hides the
               * content visually without unmounting it.
               */}
              <TabsContent value="ledger" forceMount className="mt-8">
                <div className="flex flex-col gap-8">

                  {/* SECTION 1 — Wallet Overview */}
                  <div
                    id="section-overview"
                    data-section="wallet-overview"
                    aria-label="Wallet overview"
                  >
                    {isLoading ? <OverviewSkeleton /> : (!data || data.wallets.length === 0 ? <WalletEmptyState /> : <WalletCardList />)}
                  </div>

                  {/* SECTION 2 — Category Tracking */}
                  <div
                    id="section-categories"
                    data-section="category-tracking"
                    aria-label="Category spending limits"
                  >
                    {isLoading ? <CategorySkeleton /> : <CategoryTrackingSection />}
                  </div>

                  {/* SECTION 3 — Transaction History */}
                  <div
                    id="section-transactions"
                    data-section="transaction-history"
                    aria-label="Transaction history"
                  >
                    {isLoading ? <TransactionSkeleton /> : <TransactionTable />}
                  </div>

                </div>
              </TabsContent>

              {/*
               * TAB 2 — Baselines & Debt (new content)
               *
               * No forceMount needed here — this tab has no pagination state
               * to preserve. It can mount/unmount freely.
               */}
              <TabsContent value="baselines" className="mt-8">
                {isLoading ? <BaselinesSkeleton /> : <BaselinesTab />}
              </TabsContent>

            </Tabs>

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
    </>
  );
}

