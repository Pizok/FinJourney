'use client'

/**
 * TopTransactionsCard.tsx
 *
 * Row 2 right panel (40% width) — the 5 largest expense transactions
 * within the active time range.
 *
 * Sorting:
 *   The backend pre-sorts by highest expense amount (descending).
 *   A defensive sort is applied on the frontend to guarantee order
 *   regardless of API response ordering.
 *
 * Navigation:
 *   Clicking a transaction row navigates to /wallet?highlight={id}.
 *   The wallet page is responsible for scrolling the transaction into
 *   view and highlighting it for 3–5 seconds (per analytics_state_flow.md).
 *
 * Empty state:
 *   "Additional financial activity is needed before insights can be generated."
 *   Shown when top_transactions is empty (new users, selected period has no data).
 *
 * Design rules:
 *   - Rows use hover:bg-abyssal-slate/50 — no side-stripe borders
 *   - Amounts shown as negative IDR to communicate expense (e.g. -Rp850,000)
 *   - Category + wallet in secondary text below transaction info
 *   - Date shown as locale-friendly "May 12" format
 *   - Cursor pointer indicates clickability without explicit affordances
 *   - No nested cards: rows are flat with border-bottom separators
 *
 * Canonical path: components/analytics/transactions/TopTransactionsCard.tsx
 */

import { useRouter } from 'next/navigation'
import { ReceiptText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalyticsData } from '../layout/AnalyticsContext'
import type { TopTransaction } from '../types/analytics.types'

// ─── Formatting Utilities ─────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style:                 'currency',
    currency:              'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

function formatTransactionDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Category Initial ─────────────────────────────────────────────────────────
// Visual identifier for each transaction row — a single letter in a
// muted dark container. Avoids the "emoji icon" anti-pattern from DESIGN.md.

function CategoryInitial({ name }: { name: string }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-abyssal-slate"
      aria-hidden="true"
    >
      <span className="font-display text-sm font-semibold text-muted-text">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

// ─── Transaction Row ──────────────────────────────────────────────────────────

interface TransactionRowProps {
  transaction: TopTransaction
  onClick:     (id: string) => void
  isLast:      boolean
}

function TransactionRow({ transaction, onClick, isLast }: TransactionRowProps) {
  const { id, amount, category_name, wallet_name, transaction_date } = transaction

  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={cn(
        'flex w-full items-center gap-3 px-0 py-3 text-left',
        'transition-colors duration-150',
        'hover:bg-abyssal-slate/50 rounded-lg -mx-2 px-2',
        !isLast && 'border-b border-tactical-border/60',
      )}
      aria-label={`View ${category_name} transaction of ${formatCurrency(amount)} from ${formatTransactionDate(transaction_date)} in wallet`}
    >
      {/* Category initial */}
      <CategoryInitial name={category_name} />

      {/* Transaction info */}
      <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
        <div className="min-w-0">
          <p className="truncate font-sans text-sm font-medium text-pearl-text">
            {category_name}
          </p>
          <p className="font-sans text-xs text-muted-text">
            {wallet_name} · {formatTransactionDate(transaction_date)}
          </p>
        </div>

        {/* Expense amount — negative by convention */}
        <span className="shrink-0 font-display text-sm font-semibold text-terracotta">
          -{formatCurrency(amount)}
        </span>
      </div>
    </button>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function TransactionsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-abyssal-slate">
        <ReceiptText className="h-5 w-5 text-muted-text/50" strokeWidth={2} />
      </div>
      <p className="max-w-xs text-center font-sans text-sm leading-relaxed text-muted-text">
        Additional financial activity is needed before insights can be generated.
      </p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopTransactionsCard() {
  const router    = useRouter()
  const { top_transactions: rawList = [] } = useAnalyticsData()

  /*
   * Defensive sort: backend sends highest-expense-first, but the frontend
   * re-sorts to guarantee correct order regardless of API response ordering.
   * A new array is created to avoid mutating the store slice.
   */
  const transactions = [...rawList].sort((a, b) => b.amount - a.amount)

  function handleTransactionClick(id: string) {
    /*
     * Navigate to the wallet page with a highlight query parameter.
     * The wallet page handles scrolling the transaction into view and
     * applying a temporary visual highlight for 3–5 seconds.
     */
    router.push(`/wallet?highlight=${id}`)
  }

  return (
    <section
      aria-label="Largest Transactions"
      className="flex h-full flex-col rounded-xl border border-tactical-border bg-canvas-surface p-6"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <h2 className="font-display text-base font-semibold text-pearl-text">
          Largest Transactions
        </h2>
        <p className="mt-0.5 font-sans text-xs text-muted-text">
          Review the transactions that contribute most to your monthly spending.
        </p>
      </div>

      {/* ── Transaction list or empty state ──────────────────────────────── */}
      {transactions.length === 0 ? (
        <TransactionsEmptyState />
      ) : (
        <div>
          {transactions.map((tx, idx) => (
            <TransactionRow
              key={tx.id}
              transaction={tx}
              onClick={handleTransactionClick}
              isLast={idx === transactions.length - 1}
            />
          ))}
        </div>
      )}
    </section>
  )
}
