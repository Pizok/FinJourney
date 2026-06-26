'use client';

// =============================================================================
// components/wallet/overview/TotalBalanceCard.tsx — FinJourney
//
// Shows the aggregate total balance across all wallets + a "Net Change Today"
// directional indicator derived from today's visible transactions (display only).
//
// Design notes:
//   - Two-column internal layout: [balance section | net-change section].
//     Deliberately avoids the "hero-metric template" anti-pattern (big number +
//     small label + gradient accent). Both columns have equal visual weight.
//   - Active state (global / all-wallets view): 1px muted-emerald ring.
//   - Flat surfaces. No gradient, no glow, no glassmorphism.
//   - Net change is computed from the client transaction store (display only).
//     In production this would come from the /api/v1/daily-status bootstrap.
//
// Copywriting (exact per spec):
//   - Header:           "Total Balance"
//   - Indicator label:  "Net Change Today"
// =============================================================================

import { useWalletStore, selectTotalBalance } from '@/components/finance/stores/walletStore';

// ---------------------------------------------------------------------------
// Currency Formatters
// ---------------------------------------------------------------------------

/** Full IDR format — for primary balance display. */
const formatIDR = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

/** Compact IDR — for secondary indicators (e.g. net change). */
const formatIDRCompact = (amount: number): string => {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1);
    return `Rp ${val}jt`;
  }
  if (abs >= 1_000) {
    const val = (abs / 1_000).toFixed(0);
    return `Rp ${val}rb`;
  }
  return formatIDR(abs);
};

// ---------------------------------------------------------------------------
// Net-Change Indicator Sub-component
// ---------------------------------------------------------------------------

function NetChangeIndicator({ amount }: { amount: number }) {
  const isPositive = amount > 0;
  const isNeutral = amount === 0;
  const displayValue = isNeutral
    ? '—'
    : `${isPositive ? '+' : '−'} ${formatIDRCompact(amount)}`;

  const colorClass = isNeutral
    ? 'text-[var(--color-muted-text)]'
    : isPositive
      ? 'text-[var(--color-muted-emerald)]'
      : 'text-[var(--color-terracotta)]';

  return (
    <div className="flex items-center gap-1.5">
      {/* Directional arrow icon — hidden when neutral */}
      {!isNeutral && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`${colorClass} flex-shrink-0 ${isPositive ? '' : 'rotate-180'}`}
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      )}
      <span
        className={`font-display text-lg font-semibold tabular-nums ${colorClass}`}
        style={{ fontFamily: 'var(--font-display)' }}
        aria-label={`Net change: ${displayValue}`}
      >
        {displayValue}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wallet Count Badge
// ---------------------------------------------------------------------------

function WalletCountBadge({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-[var(--color-abyssal-slate)] px-2 py-0.5 text-xs text-[var(--color-muted-text)]"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      {/* Small wallet icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
      {count} {count === 1 ? 'wallet' : 'wallets'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// TotalBalanceCard
// ---------------------------------------------------------------------------

export function TotalBalanceCard() {
  const {
    wallets,
    transactions,
    ui: { selectedWalletId },
    clearWalletSelection,
  } = useWalletStore();

  const totalBalance = useWalletStore(selectTotalBalance);
  const isActive = selectedWalletId === null;

  // -------------------------------------------------------------------------
  // Net Change Today — display-only derivation from client transaction store.
  // In production this would be supplied by the server via /api/v1/daily-status.
  // -------------------------------------------------------------------------
  const todayStr = new Date().toDateString();
  const netChangeToday = transactions.reduce((sum, tx) => {
    if (new Date(tx.created_at).toDateString() !== todayStr) return sum;
    if (tx.type === 'income') return sum + tx.amount;
    if (tx.type === 'expense') return sum - tx.amount;
    return sum; // transfers are balance-neutral
  }, 0);

  return (
    <button
      type="button"
      onClick={clearWalletSelection}
      aria-pressed={isActive}
      aria-label={`Total Balance: ${formatIDR(totalBalance)}. Click to view all wallets.`}
      className={[
        // Base surface
        'group relative flex h-full w-full min-w-[260px] flex-col justify-between gap-5',
        'rounded-xl bg-[var(--color-canvas-surface)] p-6',
        'text-left transition-all duration-200',
        // Border — active state uses emerald ring
        isActive
          ? 'border border-[var(--color-muted-emerald)]/70'
          : 'border border-[var(--color-tactical-border)] hover:border-[var(--color-tactical-border)]/80',
        // Focus ring
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-muted-emerald)]',
      ].join(' ')}
    >
      {/*
       * Active indicator was removed per user request.
       */}

      {/* ------------------------------------------------------------------ */}
      {/* Upper: header + wallet count                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between">
        <span
          className="text-xs font-medium uppercase tracking-widest text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          Total Balance
        </span>
        <WalletCountBadge count={wallets.length} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main: two-column layout                                             */}
      {/*   Left  → total balance (primary)                                  */}
      {/*   Right → net change today (secondary, equal visual weight)        */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-end justify-between gap-4">
        {/* Balance column */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate font-display text-3xl font-semibold tabular-nums text-[var(--color-pearl-text)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {formatIDR(totalBalance)}
          </p>
        </div>

        {/* Divider — vertical hairline */}
        <div
          aria-hidden="true"
          className="h-8 w-px flex-shrink-0 bg-[var(--color-tactical-border)]"
        />

        {/* Net Change Today column */}
        <div className="flex-shrink-0 text-right">
          <p
            className="mb-1 text-xs text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Net Change Today
          </p>
          <NetChangeIndicator amount={netChangeToday} />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Footer: active label (only visible when active)                    */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={[
          'flex items-center gap-1.5 transition-opacity duration-200',
          isActive ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        aria-hidden={!isActive}
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-[var(--color-muted-emerald)]"
        />
        <span
          className="text-xs text-[var(--color-muted-emerald)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          All wallets
        </span>
      </div>
    </button>
  );
}

