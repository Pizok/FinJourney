'use client';

// =============================================================================
// components/wallet/transactions/TransactionTable.tsx — FinJourney
//
// Full transaction ledger for the Wallet page.
//
// Features:
//   - Desktop: semantic <table> with all 8 columns, min row height 56px.
//   - Mobile:  stacked transaction cards (table collapses at < sm breakpoint).
//   - Type badges: income (emerald) | expense (terracotta) | transfer (violet).
//   - Amount sign: +Rp (income), −Rp (expense), Rp (transfer).
//   - Adjustment event rows: dimmed + italic note — signals a correction entry.
//   - Pagination: page numbers + prev/next, "Showing X–Y of Z" summary.
//   - Empty state: "No Transactions Yet" with Add Transaction CTA.
//   - Inline actions: edit (pencil) + delete (trash) per row.
//
// Copywriting (exact per spec):
//   Header:   "Transaction History"
//   Columns:  "Date | Type | Amount | Wallet | Category | Payment Method | Note | Actions"
//   Empty:    "No Transactions Yet" / [body copy] / "Add Transaction"
//
// Section includes:
//   - TransactionFilters (rendered above the table)
//   - Pagination controls (below the table)
//   - "Add Transaction" header button (calls openAddTransaction from store)
//   - DeleteTransactionModal wired via store (rendered at section level)
// =============================================================================

import { useShallow } from 'zustand/shallow';
import { useWalletStore, selectFilteredTransactions } from '@/components/finance/stores/walletStore';
import { TransactionFilters } from './TransactionFilters';
import type { Transaction, TransactionType, PaymentMethod } from '@/types/wallet.types';

// ---------------------------------------------------------------------------
// Display maps
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<TransactionType, {
  label: string;
  bgClass: string;
  textClass: string;
  amountPrefix: string;
  amountClass: string;
}> = {
  income: {
    label: 'Income',
    bgClass:  'bg-[var(--color-muted-emerald)]/10',
    textClass: 'text-[var(--color-muted-emerald)]',
    amountPrefix: '+',
    amountClass: 'text-[var(--color-muted-emerald)]',
  },
  expense: {
    label: 'Expense',
    bgClass:  'bg-[var(--color-terracotta)]/10',
    textClass: 'text-[var(--color-terracotta)]',
    amountPrefix: '−',
    amountClass: 'text-[var(--color-terracotta)]',
  },
  transfer: {
    label: 'Transfer',
    bgClass:  'bg-[var(--color-steel-violet)]/10',
    textClass: 'text-[var(--color-steel-violet)]',
    amountPrefix: '',
    amountClass: 'text-[var(--color-muted-text)]',
  },
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash:         'Cash',
  debit_card:   'Debit',
  credit_card:  'Credit',
  transfer:     'Transfer',
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const formatIDR = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));

const formatTime = (iso: string): string =>
  new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

// ---------------------------------------------------------------------------
// Type Badge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: TransactionType }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span
      className={[
        'inline-block rounded-md px-2 py-0.5 text-xs font-medium',
        cfg.bgClass,
        cfg.textClass,
      ].join(' ')}
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Adjustment badge
// ---------------------------------------------------------------------------

function AdjBadge() {
  return (
    <span
      className="ml-1 rounded bg-[var(--color-tactical-border)]/40 px-1 py-0.5 text-[10px] text-[var(--color-muted-text)]"
      title="Adjustment entry — original record preserved"
      aria-label="Adjustment entry"
    >
      adj
    </span>
  );
}

// ---------------------------------------------------------------------------
// Row action buttons
// ---------------------------------------------------------------------------

function ActionButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={label}
      className={[
        'flex h-7 w-7 items-center justify-center rounded-md',
        'transition-colors focus-visible:outline focus-visible:outline-2',
        'focus-visible:outline-offset-1 focus-visible:outline-[var(--color-muted-emerald)]',
        danger
          ? 'text-[var(--color-muted-text)] hover:bg-[var(--color-terracotta)]/10 hover:text-[var(--color-terracotta)]'
          : 'text-[var(--color-muted-text)] hover:bg-[var(--color-abyssal-slate)] hover:text-[var(--color-pearl-text)]',
      ].join(' ')}
    >
      {icon}
    </button>
  );
}

const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

// ---------------------------------------------------------------------------
// Desktop table row
// ---------------------------------------------------------------------------

interface RowProps {
  tx: Transaction;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function getWalletDisplayName(tx: Transaction, wallets: any[]): string {
  if (tx.type === 'transfer') {
    const src = wallets.find((w) => w.id === tx.source_wallet_id)?.name || 'Unknown';
    const dst = wallets.find((w) => w.id === tx.destination_wallet_id)?.name || 'Unknown';
    return `${src} → ${dst}`;
  }
  return tx.wallet_name || '—';
}

function DesktopRow({ tx, onEdit, onDelete }: RowProps) {
  const cfg = TYPE_CONFIG[tx.type];
  const isAdj = tx.is_adjustment_event;
  const wallets = useWalletStore((s) => s.wallets);
  const walletDisplayName = getWalletDisplayName(tx, wallets);

  return (
    <tr
      className={[
        'group border-b border-[var(--color-tactical-border)]/50',
        'last:border-b-0 transition-colors',
        'hover:bg-[var(--color-abyssal-slate)]/50',
        isAdj ? 'opacity-70' : '',
      ].join(' ')}
    >
      {/* Date — exact copy column header: "Date" */}
      <td className="px-5 py-0" style={{ minHeight: '56px' }}>
        <div className="flex min-h-[56px] flex-col justify-center">
          <span
            className="text-sm text-[var(--color-pearl-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {formatDate(tx.created_at)}
          </span>
          <span
            className="text-xs text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {formatTime(tx.created_at)}
          </span>
        </div>
      </td>

      {/* Type */}
      <td className="px-5 py-0">
        <TypeBadge type={tx.type} />
      </td>

      {/* Amount */}
      <td className="px-5 py-0 text-right">
        <span
          className={['text-sm font-semibold tabular-nums', cfg.amountClass].join(' ')}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {cfg.amountPrefix && (
            <span className="mr-0.5">{cfg.amountPrefix}</span>
          )}
          {formatIDR(tx.amount)}
        </span>
      </td>

      {/* Wallet */}
      <td className="px-5 py-0">
        <span
          className="inline-block max-w-[120px] truncate rounded-md bg-[var(--color-abyssal-slate)] px-2 py-0.5 text-xs text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
          title={walletDisplayName}
        >
          {walletDisplayName}
        </span>
      </td>

      {/* Category */}
      <td className="px-5 py-0">
        {tx.category_name ? (
          <span
            className="text-sm text-[var(--color-pearl-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {tx.category_name}
          </span>
        ) : (
          <span className="text-xs text-[var(--color-muted-text)]">—</span>
        )}
      </td>

      {/* Payment Method */}
      <td className="px-5 py-0">
        <span
          className="text-sm text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {PAYMENT_LABELS[tx.payment_method]}
        </span>
      </td>

      {/* Note */}
      <td className="max-w-[180px] px-5 py-0">
        {tx.note ? (
          <span
            className={[
              'block truncate text-sm text-[var(--color-muted-text)]',
              isAdj ? 'italic' : '',
            ].join(' ')}
            title={tx.note}
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {tx.note}
            {isAdj && <AdjBadge />}
          </span>
        ) : (
          <span className="text-xs text-[var(--color-muted-text)]">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-0">
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <ActionButton
            icon={<PencilIcon />}
            label={`Edit transaction from ${walletDisplayName}`}
            onClick={() => onEdit(tx.id)}
          />
          <ActionButton
            icon={<TrashIcon />}
            label={`Delete transaction from ${walletDisplayName}`}
            onClick={() => onDelete(tx.id)}
            danger
          />
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Mobile card (stacked layout)
// ---------------------------------------------------------------------------

function MobileCard({ tx, onEdit, onDelete }: RowProps) {
  const cfg = TYPE_CONFIG[tx.type];
  const isAdj = tx.is_adjustment_event;
  const wallets = useWalletStore((s) => s.wallets);
  const walletDisplayName = getWalletDisplayName(tx, wallets);

  return (
    <div
      className={[
        'flex items-start justify-between gap-4 p-4',
        'border-b border-[var(--color-tactical-border)]/50 last:border-b-0',
        isAdj ? 'opacity-70' : '',
      ].join(' ')}
    >
      {/* Left: date + meta */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <TypeBadge type={tx.type} />
          <span
            className="text-xs text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {formatDate(tx.created_at)}
          </span>
        </div>

        {tx.category_name && (
          <span
            className="text-sm text-[var(--color-pearl-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {tx.category_name}
          </span>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className="rounded bg-[var(--color-abyssal-slate)] px-1.5 py-0.5 text-xs text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {walletDisplayName}
          </span>
          <span
            className="text-xs text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {PAYMENT_LABELS[tx.payment_method]}
          </span>
        </div>

        {tx.note && (
          <p
            className={[
              'truncate text-xs text-[var(--color-muted-text)]',
              isAdj ? 'italic' : '',
            ].join(' ')}
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {tx.note}
            {isAdj && <AdjBadge />}
          </p>
        )}
      </div>

      {/* Right: amount + actions */}
      <div className="flex flex-col items-end gap-2">
        <span
          className={['text-sm font-semibold tabular-nums', cfg.amountClass].join(' ')}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {cfg.amountPrefix}{formatIDR(tx.amount)}
        </span>
        <div className="flex items-center gap-1">
          <ActionButton icon={<PencilIcon />} label="Edit" onClick={() => onEdit(tx.id)} />
          <ActionButton icon={<TrashIcon />} label="Delete" onClick={() => onDelete(tx.id)} danger />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyTransactions({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-abyssal-slate)] text-[var(--color-muted-text)]"
      >
        {/* Receipt icon */}
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 17.5v-11" />
        </svg>
      </div>
      {/* Exact copy per spec */}
      <h3
        className="mb-2 font-display text-base font-semibold text-[var(--color-pearl-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        No Transactions Yet
      </h3>
      <p
        className="mb-7 max-w-xs text-sm leading-relaxed text-[var(--color-muted-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        No financial activity has been recorded for this view. Add an income, expense, or transfer to begin tracking your progress.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className={[
          'inline-flex items-center gap-2 rounded-lg',
          'border border-[var(--color-muted-emerald)] px-4 py-2.5',
          'text-sm font-medium text-[var(--color-muted-emerald)]',
          'transition-colors hover:bg-[var(--color-muted-emerald)]/10',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'focus-visible:outline-[var(--color-muted-emerald)]',
        ].join(' ')}
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <path d="M5 12h14" /><path d="M12 5v14" />
        </svg>
        {/* Exact copy per spec */}
        Add Transaction
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function Pagination() {
  const { pagination, setPage } = useWalletStore();
  const { page, limit, total_items, total_pages } = pagination;

  if (total_pages <= 1) return null;

  const from = ((page - 1) * limit) + 1;
  const to   = Math.min(page * limit, total_items);

  // Build page list: show up to 5 pages around current
  const pages: (number | '…')[] = [];
  if (total_pages <= 7) {
    for (let i = 1; i <= total_pages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(total_pages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < total_pages - 2) pages.push('…');
    pages.push(total_pages);
  }

  const btnBase = [
    'flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2',
    'text-xs transition-colors focus-visible:outline focus-visible:outline-2',
    'focus-visible:outline-offset-1 focus-visible:outline-[var(--color-muted-emerald)]',
  ].join(' ');

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      {/* Summary */}
      <p
        className="text-xs text-[var(--color-muted-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
        aria-live="polite"
      >
        Showing {from}–{to} of {total_items} transactions
      </p>

      {/* Page buttons */}
      <nav aria-label="Transaction pagination" className="flex items-center gap-1">
        {/* Previous */}
        <button
          type="button"
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          className={[
            btnBase,
            'border border-[var(--color-tactical-border)] text-[var(--color-muted-text)]',
            'hover:border-[var(--color-muted-text)] disabled:cursor-not-allowed disabled:opacity-30',
          ].join(' ')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-[var(--color-muted-text)]">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p as number)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              className={[
                btnBase,
                'border',
                p === page
                  ? 'border-[var(--color-muted-emerald)] bg-[var(--color-muted-emerald)]/10 text-[var(--color-muted-emerald)]'
                  : 'border-[var(--color-tactical-border)] text-[var(--color-muted-text)] hover:border-[var(--color-muted-text)]',
              ].join(' ')}
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          type="button"
          onClick={() => setPage(page + 1)}
          disabled={page === total_pages}
          aria-label="Next page"
          className={[
            btnBase,
            'border border-[var(--color-tactical-border)] text-[var(--color-muted-text)]',
            'hover:border-[var(--color-muted-text)] disabled:cursor-not-allowed disabled:opacity-30',
          ].join(' ')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransactionTable — Main Export
// ---------------------------------------------------------------------------

export function TransactionTable() {
  const {
    loading,
    ui: { selectedWalletId },
    openAddTransaction,
    openEditTransaction,
    openDeleteTransaction,
  } = useWalletStore();

  const transactions = useWalletStore(useShallow(selectFilteredTransactions));

  const isLoading = loading.transactions;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <section aria-labelledby="tx-history-heading">

      {/* ------------------------------------------------------------------ */}
      {/* Section header row                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-4 flex items-center justify-between gap-4">
        {/* Exact header copy per spec: "Transaction History" */}
        <h2
          id="tx-history-heading"
          className="font-display text-sm font-semibold uppercase tracking-widest text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Transaction History
        </h2>

        {/* Add Transaction CTA — hollow emerald, no glow (dashboard rule) */}
        <button
          type="button"
          onClick={openAddTransaction}
          className={[
            'inline-flex items-center gap-2 rounded-lg px-4 py-2',
            'border border-[var(--color-muted-emerald)]',
            'text-sm font-medium text-[var(--color-muted-emerald)]',
            'transition-colors hover:bg-[var(--color-muted-emerald)]/10',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
            'focus-visible:outline-[var(--color-muted-emerald)]',
          ].join(' ')}
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d="M5 12h14" /><path d="M12 5v14" />
          </svg>
          Add Transaction
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Filter bar                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-5">
        <TransactionFilters />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Table container                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)]">

        {/* ---- Loading shimmer ---- */}
        {isLoading && (
          <div aria-busy="true" aria-label="Loading transactions">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}
                className="flex animate-pulse items-center gap-4 border-b border-[var(--color-tactical-border)]/50 px-5 py-4 last:border-b-0">
                <div className="h-3 w-20 rounded bg-[var(--color-tactical-border)]/40" />
                <div className="h-5 w-14 rounded-md bg-[var(--color-tactical-border)]/40" />
                <div className="ml-auto h-4 w-24 rounded bg-[var(--color-tactical-border)]/40" />
              </div>
            ))}
          </div>
        )}

        {/* ---- Empty state ---- */}
        {!isLoading && transactions.length === 0 && (
          <EmptyTransactions onAdd={openAddTransaction} />
        )}

        {/* ---- Desktop table (hidden on mobile) ---- */}
        {!isLoading && transactions.length > 0 && (
          <div className="hidden sm:block overflow-x-auto">
            <table
              className="w-full border-collapse"
              aria-label="Transaction history"
            >
              {/* Table head — exact column names per spec */}
              <thead>
                <tr className="border-b border-[var(--color-tactical-border)]">
                  {[
                    { key: 'date',    label: 'Date',           align: 'left'  },
                    { key: 'type',    label: 'Type',           align: 'left'  },
                    { key: 'amount',  label: 'Amount',         align: 'right' },
                    { key: 'wallet',  label: 'Wallet',         align: 'left'  },
                    { key: 'cat',     label: 'Category',       align: 'left'  },
                    { key: 'method',  label: 'Payment Method', align: 'left'  },
                    { key: 'note',    label: 'Note',           align: 'left'  },
                    { key: 'actions', label: 'Actions',        align: 'left'  },
                  ].map(({ key, label, align }) => (
                    <th
                      key={key}
                      scope="col"
                      className={[
                        'px-5 py-3 text-xs font-semibold uppercase tracking-wider',
                        'text-[var(--color-muted-text)]',
                        align === 'right' ? 'text-right' : 'text-left',
                      ].join(' ')}
                      style={{ fontFamily: 'var(--font-sans)' }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table body */}
              <tbody>
                {transactions.map((tx) => (
                  <DesktopRow
                    key={tx.id}
                    tx={tx}
                    onEdit={openEditTransaction}
                    onDelete={openDeleteTransaction}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- Mobile stacked cards (hidden on sm+) ---- */}
        {!isLoading && transactions.length > 0 && (
          <div className="block sm:hidden" role="list" aria-label="Transactions">
            {transactions.map((tx) => (
              <div key={tx.id} role="listitem">
                <MobileCard
                  tx={tx}
                  onEdit={openEditTransaction}
                  onDelete={openDeleteTransaction}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Pagination                                                          */}
      {/* ------------------------------------------------------------------ */}
      {!isLoading && <Pagination />}
    </section>
  );
}

