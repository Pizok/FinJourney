'use client';

// =============================================================================
// components/wallet/transactions/TransactionFilters.tsx — FinJourney
//
// Filter bar for the Transaction History section.
//
// Controls (from spec, exact copy):
//   Search:    "Search transactions or notes..."
//   Dropdowns: "Filter by Wallet" | "Filter by Category" | "Transaction Type"
//              "Payment Method"
//   Sort:      "Newest First" | "Oldest First" | "Highest Amount" | "Lowest Amount"
//
// Behaviour:
//   - Reads/writes `filterState` directly in the Zustand store.
//   - Any active filter (except sort=newest) increments the active-filter badge.
//   - "Clear all" button resets to default state.
//   - On mobile: filter controls collapse behind a "Filters (N)" toggle button;
//     expand into a stacked panel below the search bar.
//
// Performance:
//   - Search input is debounced (300ms) before updating the store to
//     avoid triggering re-renders on every keystroke.
// =============================================================================

import { useState, useEffect, useRef, useId } from 'react';
import { useWalletStore } from '@/components/wallet/stores/walletStore';
import type { TransactionType, PaymentMethod, SortOption, FilterState } from '@/types/wallet.types';

// ---------------------------------------------------------------------------
// Shared styled select (inline — not importing BaseModal to avoid circular dep)
// ---------------------------------------------------------------------------

interface FilterSelectProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
  hasValue: boolean;
}

function FilterSelect({ id, value, onChange, placeholder, children, hasValue }: FilterSelectProps) {
  return (
    <div className="relative flex-shrink-0">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        className={[
          'h-9 min-w-[148px] cursor-pointer appearance-none rounded-lg',
          'border bg-[var(--color-canvas-surface)] pl-3 pr-8 text-xs',
          'transition-colors duration-150 focus:outline-none',
          hasValue
            ? 'border-[var(--color-muted-emerald)] text-[var(--color-pearl-text)] focus:border-[var(--color-muted-emerald)]'
            : 'border-[var(--color-tactical-border)] text-[var(--color-muted-text)] focus:border-[var(--color-muted-emerald)]',
        ].join(' ')}
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {children}
      </select>
      {/* Chevron */}
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-text)]">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active filter count
// ---------------------------------------------------------------------------

function countActiveFilters(f: FilterState): number {
  let count = 0;
  if (f.wallet_id)         count++;
  if (f.transaction_type)  count++;
  if (f.category_id)       count++;
  if (f.payment_method)    count++;
  if (f.start_date || f.end_date) count++;
  if (f.min_amount !== undefined || f.max_amount !== undefined) count++;
  if (f.search?.trim())    count++;
  // sort is not counted — it's always set (defaults to 'newest')
  return count;
}

// ---------------------------------------------------------------------------
// TransactionFilters
// ---------------------------------------------------------------------------

export function TransactionFilters() {
  const {
    wallets,
    categories,
    filterState,
    setFilter,
    clearFilters,
  } = useWalletStore();

  const searchId = useId();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Local search state for debounce
  const [localSearch, setLocalSearch] = useState(filterState.search ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCount = countActiveFilters(filterState);

  // -------------------------------------------------------------------------
  // Debounced search sync
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilter({ search: localSearch || undefined });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localSearch, setFilter]);

  // Keep local state in sync if store is cleared externally
  useEffect(() => {
    if (!filterState.search && localSearch) setLocalSearch('');
  }, [filterState.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Clear handler
  // -------------------------------------------------------------------------
  const handleClear = () => {
    clearFilters();
    setLocalSearch('');
  };

  // -------------------------------------------------------------------------
  // Filter controls JSX (shared between desktop and mobile panel)
  // -------------------------------------------------------------------------
  const filterControls = (
    <div className="flex flex-wrap items-center gap-2">

      {/* Filter by Wallet */}
      <FilterSelect
        id="filter-wallet"
        placeholder="Filter by Wallet"
        value={filterState.wallet_id ?? ''}
        hasValue={Boolean(filterState.wallet_id)}
        onChange={(v) => setFilter({ wallet_id: v || undefined })}
      >
        <option value="">Filter by Wallet</option>
        {wallets.map((w) => (
          <option key={w.id} value={w.id}
            style={{ background: 'var(--color-canvas-surface)' }}>
            {w.name}
          </option>
        ))}
      </FilterSelect>

      {/* Filter by Category */}
      <FilterSelect
        id="filter-category"
        placeholder="Filter by Category"
        value={filterState.category_id ?? ''}
        hasValue={Boolean(filterState.category_id)}
        onChange={(v) => setFilter({ category_id: v || undefined })}
      >
        <option value="">Filter by Category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}
            style={{ background: 'var(--color-canvas-surface)' }}>
            {c.name}
          </option>
        ))}
      </FilterSelect>

      {/* Transaction Type */}
      <FilterSelect
        id="filter-type"
        placeholder="Transaction Type"
        value={filterState.transaction_type ?? ''}
        hasValue={Boolean(filterState.transaction_type)}
        onChange={(v) => setFilter({ transaction_type: (v as TransactionType) || undefined })}
      >
        <option value="">Transaction Type</option>
        <option value="income"   style={{ background: 'var(--color-canvas-surface)' }}>Income</option>
        <option value="expense"  style={{ background: 'var(--color-canvas-surface)' }}>Expense</option>
        <option value="transfer" style={{ background: 'var(--color-canvas-surface)' }}>Transfer</option>
      </FilterSelect>

      {/* Payment Method */}
      <FilterSelect
        id="filter-payment"
        placeholder="Payment Method"
        value={filterState.payment_method ?? ''}
        hasValue={Boolean(filterState.payment_method)}
        onChange={(v) => setFilter({ payment_method: (v as PaymentMethod) || undefined })}
      >
        <option value="">Payment Method</option>
        <option value="cash"          style={{ background: 'var(--color-canvas-surface)' }}>Cash</option>
        <option value="debit_card"    style={{ background: 'var(--color-canvas-surface)' }}>Debit Card</option>
        <option value="credit_card"   style={{ background: 'var(--color-canvas-surface)' }}>Credit Card</option>
        <option value="transfer"      style={{ background: 'var(--color-canvas-surface)' }}>Bank Transfer</option>
      </FilterSelect>

      {/* Sort */}
      <FilterSelect
        id="filter-sort"
        placeholder="Newest First"
        value={filterState.sort ?? 'newest'}
        hasValue={Boolean(filterState.sort && filterState.sort !== 'newest')}
        onChange={(v) => setFilter({ sort: (v as SortOption) || 'newest' })}
      >
        <option value="newest"      style={{ background: 'var(--color-canvas-surface)' }}>Newest First</option>
        <option value="oldest"      style={{ background: 'var(--color-canvas-surface)' }}>Oldest First</option>
        <option value="amount_desc" style={{ background: 'var(--color-canvas-surface)' }}>Highest Amount</option>
        <option value="amount_asc"  style={{ background: 'var(--color-canvas-surface)' }}>Lowest Amount</option>
      </FilterSelect>

      {/* Clear all — only shown when a filter is active */}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className={[
            'flex h-9 items-center gap-1.5 rounded-lg px-3',
            'border border-[var(--color-tactical-border)]',
            'text-xs text-[var(--color-muted-text)]',
            'transition-colors hover:border-[var(--color-terracotta)]/50 hover:text-[var(--color-terracotta)]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1',
            'focus-visible:outline-[var(--color-muted-emerald)]',
          ].join(' ')}
          style={{ fontFamily: 'var(--font-sans)' }}
          aria-label="Clear all active filters"
        >
          {/* X icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
          Clear
        </button>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-3">
      {/* ------------------------------------------------------------------ */}
      {/* Row 1: search + mobile toggle                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          {/* Search icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-text)]">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            id={searchId}
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            // Exact copy per spec
            placeholder="Search transactions or notes..."
            aria-label="Search transactions or notes"
            className={[
              'h-9 w-full rounded-lg',
              'border border-[var(--color-tactical-border)]',
              'bg-[var(--color-canvas-surface)]',
              'pl-9 pr-3.5 text-sm text-[var(--color-pearl-text)]',
              'placeholder:text-[var(--color-muted-text)]',
              'transition-colors focus:border-[var(--color-muted-emerald)] focus:outline-none',
              localSearch ? 'border-[var(--color-muted-emerald)]' : '',
            ].join(' ')}
            style={{ fontFamily: 'var(--font-sans)' }}
          />
        </div>

        {/* Mobile: "Filters" toggle button */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label={`${mobileOpen ? 'Hide' : 'Show'} filters${activeCount > 0 ? ` (${activeCount} active)` : ''}`}
          className={[
            'flex h-9 flex-shrink-0 items-center gap-2 rounded-lg px-3',
            'border text-xs transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1',
            'focus-visible:outline-[var(--color-muted-emerald)] sm:hidden',
            activeCount > 0
              ? 'border-[var(--color-muted-emerald)] text-[var(--color-pearl-text)]'
              : 'border-[var(--color-tactical-border)] text-[var(--color-muted-text)]',
          ].join(' ')}
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {/* Filter icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-muted-emerald)] text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 2: filter controls                                             */}
      {/*   Desktop: always visible                                          */}
      {/*   Mobile: shown only when mobileOpen === true                     */}
      {/* ------------------------------------------------------------------ */}
      <div className={[
        'sm:block',
        mobileOpen ? 'block' : 'hidden',
      ].join(' ')}>
        {filterControls}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Active filter summary (desktop: inline below controls)            */}
      {/* ------------------------------------------------------------------ */}
      {activeCount > 0 && (
        <p
          className="text-xs text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
          aria-live="polite"
          aria-atomic="true"
        >
          {activeCount} {activeCount === 1 ? 'filter' : 'filters'} active
          {filterState.search && ` · Searching "${filterState.search}"`}
        </p>
      )}
    </div>
  );
}
