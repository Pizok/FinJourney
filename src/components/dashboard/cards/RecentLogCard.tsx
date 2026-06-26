'use client';

import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronRight,
} from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import {
  formatTransactionAmount,
  formatRelativeTime,
  cn,
} from '../utils/dashboard.helpers';
import type { Transaction, TransactionType } from '../types/dashboard.types';

// ─── Transaction Row ────────────────────────────────────────────────────────────

const TYPE_ICON: Record<TransactionType, React.ElementType> = {
  income: ArrowUpRight,
  expense: ArrowDownLeft,
  transfer: ArrowLeftRight,
};

const TYPE_AMOUNT_CLASS: Record<TransactionType, string> = {
  income: 'text-muted-emerald',
  expense: 'text-pearl-text',
  transfer: 'text-muted-text',
};

const TYPE_ICON_CLASS: Record<TransactionType, string> = {
  income: 'text-muted-emerald bg-muted-emerald/10',
  expense: 'text-muted-text bg-abyssal-slate',
  transfer: 'text-steel-violet bg-steel-violet/10',
};

function TransactionRow({ tx }: { tx: Transaction }) {
  const Icon = TYPE_ICON[tx.type];
  const amountClass = TYPE_AMOUNT_CLASS[tx.type];
  const iconClass = TYPE_ICON_CLASS[tx.type];
  const label = tx.note || tx.category_name;

  return (
    <li className="flex items-center gap-3 py-3 border-b border-tactical-border last:border-b-0">
      {/* Icon */}
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border border-tactical-border ${iconClass}`}
      >
        <Icon size={13} strokeWidth={2} />
      </div>

      {/* Label + meta */}
      <div className="flex-1 min-w-0">
        <p className="font-sans text-sm text-pearl-text truncate">{label}</p>
        <p className="font-sans text-xs text-muted-text truncate">
          {tx.category_name} · {formatRelativeTime(tx.logged_at)}
        </p>
      </div>

      {/* Amount */}
      <span className={`font-sans text-sm font-medium flex-shrink-0 ${amountClass}`}>
        {formatTransactionAmount(tx.amount, tx.type)}
      </span>
    </li>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="py-8 flex flex-col items-center justify-center text-center">
      <p className="font-sans text-sm text-muted-text max-w-xs">
        No transactions recorded yet. Start by logging your first activity.
      </p>
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────

export function RecentLogCard() {
  const { data } = useDashboardData();
  const transactions = data.recent_transactions.slice(0, 5);
  const isEmpty = transactions.length === 0;

  return (
    <article className="bg-canvas-surface border border-tactical-border rounded-xl p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-sm font-semibold text-pearl-text uppercase tracking-widest">
          Recent Activity
        </h2>
        <Link
          href="/wallets"
          className="inline-flex items-center gap-1 font-sans text-xs text-muted-text hover:text-pearl-text transition-colors"
        >
          Open Wallet
          <ChevronRight size={12} strokeWidth={2} />
        </Link>
      </div>

      {/* Transaction list or empty state */}
      {isEmpty ? (
        <EmptyState />
      ) : (
        <ul aria-label="Recent transactions">
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </ul>
      )}
    </article>
  );
}
