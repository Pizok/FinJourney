'use client';

// =============================================================================
// components/wallet/overview/WalletCard.tsx — FinJourney
//
// Individual wallet card for the horizontal overview row.
//
// Design notes:
//   - Color token is surfaced as a tinted icon container background + a 1px
//     box-shadow ring on the selected state. NOT as a side-stripe border.
//   - Selected state: token-colored box-shadow ring (avoids layout shift from
//     border-width changes) + subtle background tint.
//   - Three-dot menu triggers wallet settings (does not open inline — passed
//     up via `onOpenSettings` to parent for modal orchestration in Part 3).
//   - Flat surfaces. No glassmorphism. No glow.
//
// Copywriting (exact per spec):
//   - Context menu item:       "Wallet Settings"
//   - Payment indicator label: "Default Payment Method: [Method]"
// =============================================================================

import { useState, useRef, useEffect } from 'react';
import type { Wallet, ColorToken, WalletType, PaymentMethod } from '@/types/wallet.types';

// ---------------------------------------------------------------------------
// Display Maps
// ---------------------------------------------------------------------------

const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  cash: 'Cash',
  bank: 'Bank',
  savings: 'Savings',
  investment: 'Investment',
  credit: 'Credit',
  e_wallet: 'E-Wallet',
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  debit_card: 'Debit Card',
  credit_card: 'Credit Card',
  transfer: 'Transfer',
  e_wallet: 'E-Wallet',
  qr_code: 'QR Code',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Color Token → CSS Variable Maps
// ---------------------------------------------------------------------------

/** Icon container background — token color at ~10% opacity via Tailwind. */
const TOKEN_BG: Record<ColorToken, string> = {
  emerald:    'bg-[var(--color-muted-emerald)]/10',
  violet:     'bg-[var(--color-steel-violet)]/10',
  gold:       'bg-[var(--color-dawn-gold)]/10',
  slate:      'bg-[var(--color-tactical-border)]/30',
  terracotta: 'bg-[var(--color-terracotta)]/10',
};

/** Icon foreground color — full token accent. */
const TOKEN_TEXT: Record<ColorToken, string> = {
  emerald:    'text-[var(--color-muted-emerald)]',
  violet:     'text-[var(--color-steel-violet)]',
  gold:       'text-[var(--color-dawn-gold)]',
  slate:      'text-[var(--color-muted-text)]',
  terracotta: 'text-[var(--color-terracotta)]',
};

/** Selected-state box-shadow ring color (CSS var string). */
const TOKEN_RING_CSS: Record<ColorToken, string> = {
  emerald:    'var(--color-muted-emerald)',
  violet:     'var(--color-steel-violet)',
  gold:       'var(--color-dawn-gold)',
  slate:      'var(--color-tactical-border)',
  terracotta: 'var(--color-terracotta)',
};

/** Active top-line indicator color (CSS var string). */
const TOKEN_LINE_CSS: Record<ColorToken, string> = TOKEN_RING_CSS;

// ---------------------------------------------------------------------------
// Wallet Type Icons (Lucide-style, strokeWidth 2)
// ---------------------------------------------------------------------------

function WalletTypeIcon({ type, className = '' }: { type: WalletType; className?: string }) {
  if (type === 'cash') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true" className={className}>
        <rect width="20" height="12" x="2" y="6" rx="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    );
  }
  if (type === 'credit') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true" className={className}>
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
    );
  }
  if (type === 'savings' || type === 'investment') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true" className={className}>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  // bank (default)
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className={className}>
      <line x1="3" x2="21" y1="22" y2="22" />
      <line x1="6" x2="6" y1="18" y2="11" />
      <line x1="10" x2="10" y1="18" y2="11" />
      <line x1="14" x2="14" y1="18" y2="11" />
      <line x1="18" x2="18" y1="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Currency Formatter
// ---------------------------------------------------------------------------

const formatIDR = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

// ---------------------------------------------------------------------------
// Context Menu (three-dot)
// ---------------------------------------------------------------------------

interface ContextMenuProps {
  walletId: string;
  onOpenSettings: (id: string) => void;
}

function ContextMenu({ walletId, onOpenSettings }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // prevent card selection on menu click
          setOpen((v) => !v);
        }}
        aria-label="Wallet options"
        aria-expanded={open}
        aria-haspopup="menu"
        className={[
          'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
          'text-[var(--color-muted-text)] hover:bg-[var(--color-abyssal-slate)] hover:text-[var(--color-pearl-text)]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1',
          'focus-visible:outline-[var(--color-muted-emerald)]',
          open ? 'bg-[var(--color-abyssal-slate)] text-[var(--color-pearl-text)]' : '',
        ].join(' ')}
      >
        {/* Ellipsis icon */}
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Wallet actions"
          className={[
            'absolute right-0 top-full z-20 mt-1',
            'min-w-[148px] overflow-hidden rounded-lg',
            'border border-[var(--color-tactical-border)]',
            'bg-[var(--color-canvas-surface)] shadow-lg shadow-black/40',
            'animate-fade-in',
          ].join(' ')}
        >
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onOpenSettings(walletId);
            }}
            className={[
              'flex w-full items-center gap-2.5 px-3.5 py-2.5',
              'text-left text-sm text-[var(--color-pearl-text)]',
              'hover:bg-[var(--color-abyssal-slate)]',
              'focus-visible:bg-[var(--color-abyssal-slate)] focus-visible:outline-none',
              'transition-colors',
            ].join(' ')}
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {/* Settings gear icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true" className="text-[var(--color-muted-text)]">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Wallet Settings
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WalletCard Props
// ---------------------------------------------------------------------------

interface WalletCardProps {
  wallet: Wallet;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onOpenSettings: (id: string) => void;
}

// ---------------------------------------------------------------------------
// WalletCard
// ---------------------------------------------------------------------------

export function WalletCard({ wallet, isSelected, onSelect, onOpenSettings }: WalletCardProps) {
  const ringColor = TOKEN_RING_CSS[wallet.color_token];
  const lineColor = TOKEN_LINE_CSS[wallet.color_token];
  const isNegative = wallet.balance < 0;

  return (
    <article
      className={[
        // Base layout
        'group relative flex h-full min-w-[195px] max-w-[240px] flex-col justify-between gap-5',
        'rounded-xl bg-[var(--color-canvas-surface)] p-5',
        'border border-[var(--color-tactical-border)]',
        'cursor-pointer select-none transition-all duration-200',
        // Hover: lift border slightly
        !isSelected && 'hover:border-[var(--color-tactical-border)]/60',
        // Focus-visible for keyboard navigation
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-muted-emerald)]',
      ].join(' ')}
      style={
        isSelected
          ? {
              // Token-colored ring: avoids border-width layout shift
              boxShadow: `0 0 0 1px ${ringColor}`,
              borderColor: ringColor,
            }
          : undefined
      }
      onClick={() => onSelect(wallet.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(wallet.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${wallet.name} wallet, balance ${formatIDR(wallet.balance)}. Click to filter.`}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header row: type icon + three-dot menu                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between">
        {/* Icon container — token color as subtle background tint */}
        <div
          className={[
            'flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0',
            TOKEN_BG[wallet.color_token],
            TOKEN_TEXT[wallet.color_token],
          ].join(' ')}
          aria-hidden="true"
        >
          <WalletTypeIcon type={wallet.type} />
        </div>

        {/* Context menu — stops propagation so clicking it doesn't select card */}
        <ContextMenu walletId={wallet.id} onOpenSettings={onOpenSettings} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Balance                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <p
          className={[
            'font-display text-2xl font-semibold tabular-nums leading-tight',
            isNegative
              ? 'text-[var(--color-terracotta)]'
              : 'text-[var(--color-pearl-text)]',
          ].join(' ')}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {formatIDR(wallet.balance)}
        </p>
        {isNegative && (
          <p
            className="mt-0.5 text-xs text-[var(--color-terracotta)]"
            style={{ fontFamily: 'var(--font-sans)' }}
            aria-live="polite"
          >
            Negative balance
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Footer: wallet name + type badge + default payment                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <p
          className="truncate text-sm font-medium text-[var(--color-pearl-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
          title={wallet.name}
        >
          {wallet.name}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Wallet type badge */}
          <span
            className="rounded-md bg-[var(--color-abyssal-slate)] px-2 py-0.5 text-xs text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {WALLET_TYPE_LABELS[wallet.type]}
          </span>

          {/* Payment method indicator — per spec: "Default Payment Method: [Method]" */}
          <span
            className="truncate text-xs text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
            title={`Default Payment Method: ${PAYMENT_METHOD_LABELS[wallet.default_payment_method]}`}
            aria-label={`Default Payment Method: ${PAYMENT_METHOD_LABELS[wallet.default_payment_method]}`}
          >
            · {PAYMENT_METHOD_LABELS[wallet.default_payment_method]}
          </span>
        </div>
      </div>
    </article>
  );
}
