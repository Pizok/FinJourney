'use client';

// =============================================================================
// components/wallet/overview/WalletCardList.tsx — FinJourney
//
// Top-section orchestrator. Renders the horizontal wallet overview row:
//   TotalBalanceCard | WalletCard… | AddWalletButton
//
// Layout:
//   - Desktop: horizontal flex, all cards visible with gap-4.
//   - Mobile:  horizontal scroll (overflow-x-auto), cards maintain their
//              min-width so they're fully legible without shrinking.
//
// Empty state (highest priority per wallet_state_flow.md):
//   Renders instead of the card row when wallets.length === 0.
//   Copywriting exact per spec:
//     Title:   "No Wallet Found"
//     Body:    "Create your first wallet to begin tracking balances,
//               spending, and financial activity."
//     CTA:     "Create Wallet"
//
// Level lock:
//   When featureUnlocks.can_create_wallet is false (Level 1 cap reached),
//   the Add Wallet button shows a lock icon and is visually dimmed.
//   Clicking it still calls openAddWallet() — the modal (built in Part 3)
//   handles the Level 3 unlock explanation.
// =============================================================================

import {
  useWalletStore,
  selectTotalBalance,
} from '@/components/finance/stores/walletStore';
import { TotalBalanceCard } from './TotalBalanceCard';
import { WalletCard } from './WalletCard';

// ---------------------------------------------------------------------------
// Empty State — No Wallets
// ---------------------------------------------------------------------------

function NoWalletFoundState({ onCreateWallet }: { onCreateWallet: () => void }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-tactical-border)] px-8 py-14 text-center">
      {/*
       * Icon vessel — restrained dark container per DESIGN.md anti-patterns.
       * Lucide Wallet icon, strokeWidth 2.
       */}
      <div
        aria-hidden="true"
        className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-canvas-surface)] text-[var(--color-muted-text)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
      </div>

      {/* Title — exact copy per spec */}
      <h2
        className="mb-2 font-display text-base font-semibold text-[var(--color-pearl-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        No Wallet Found
      </h2>

      {/* Body — exact copy per spec */}
      <p
        className="mb-7 max-w-[280px] text-sm leading-relaxed text-[var(--color-muted-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        Create your first wallet to begin tracking balances, spending, and financial activity.
      </p>

      {/* CTA — exact copy per spec. Hollow Muted Emerald (secondary style). */}
      <button
        type="button"
        onClick={onCreateWallet}
        className={[
          'inline-flex items-center gap-2 rounded-lg px-5 py-2.5',
          'border border-[var(--color-muted-emerald)] text-[var(--color-muted-emerald)]',
          'text-sm font-medium transition-colors',
          'hover:bg-[var(--color-muted-emerald)]/10',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'focus-visible:outline-[var(--color-muted-emerald)]',
        ].join(' ')}
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {/* Plus icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <path d="M5 12h14" /><path d="M12 5v14" />
        </svg>
        Create Wallet
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Wallet Button — appended at the end of the card row
// ---------------------------------------------------------------------------

interface AddWalletButtonProps {
  onAdd: () => void;
  isLocked: boolean;
  currentCount: number;
  maxCount: number;
}

function AddWalletButton({ onAdd, isLocked, currentCount, maxCount }: AddWalletButtonProps) {
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={
        isLocked
          ? `Wallet limit reached (${currentCount}/${maxCount}). Unlock at Level 3.`
          : 'Add new wallet'
      }
      className={[
        // Same height as wallet cards — min-w keeps it from collapsing
        'flex h-full min-w-[120px] flex-col items-center justify-center gap-3',
        'rounded-xl border border-dashed p-5',
        'transition-all duration-200 focus-visible:outline focus-visible:outline-2',
        'focus-visible:outline-offset-2 focus-visible:outline-[var(--color-muted-emerald)]',
        isLocked
          ? 'cursor-pointer border-[var(--color-tactical-border)]/50 opacity-50'
          : [
              'cursor-pointer border-[var(--color-tactical-border)]',
              'hover:border-[var(--color-muted-emerald)]/50',
              'hover:bg-[var(--color-muted-emerald)]/5',
            ].join(' '),
      ].join(' ')}
    >
      {/* Icon — lock when feature is gated, plus otherwise */}
      <span
        aria-hidden="true"
        className={[
          'flex h-9 w-9 items-center justify-center rounded-lg',
          isLocked
            ? 'bg-[var(--color-tactical-border)]/30 text-[var(--color-muted-text)]'
            : 'bg-[var(--color-muted-emerald)]/10 text-[var(--color-muted-emerald)]',
        ].join(' ')}
      >
        {isLocked ? (
          // Lock icon
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ) : (
          // Plus icon
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M12 5v14" />
          </svg>
        )}
      </span>

      <span
        className="text-center text-xs text-[var(--color-muted-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {isLocked ? (
          <>
            <span className="block">Lv. 3</span>
            <span className="block">to unlock</span>
          </>
        ) : (
          'Add Wallet'
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionHeader({ walletCount }: { walletCount: number }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2
        className="font-display text-sm font-semibold uppercase tracking-widest text-[var(--color-muted-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Overview
      </h2>
      {walletCount > 0 && (
        <span
          className="text-xs text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {walletCount} {walletCount === 1 ? 'wallet' : 'wallets'}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WalletCardList — Main Export
// ---------------------------------------------------------------------------

export function WalletCardList() {
  const {
    wallets,
    featureUnlocks,
    ui: { selectedWalletId },
    selectWallet,
    clearWalletSelection,
    openAddWallet,
    openWalletSettings,
  } = useWalletStore();

  const isAtWalletLimit =
    !featureUnlocks.can_create_wallet &&
    wallets.length >= featureUnlocks.max_wallets;

  // -------------------------------------------------------------------------
  // Empty State — highest-priority render path
  // -------------------------------------------------------------------------

  if (wallets.length === 0) {
    return (
      <section aria-labelledby="wallet-overview-heading">
        <SectionHeader walletCount={0} />
        <NoWalletFoundState onCreateWallet={openAddWallet} />
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Normal Render — horizontal scrollable card row
  // -------------------------------------------------------------------------

  return (
    <section aria-labelledby="wallet-overview-heading">
      <SectionHeader walletCount={wallets.length} />

      {/*
       * Scroll container:
       *   - overflow-x-auto for mobile horizontal scroll
       *   - pb-3 to keep scrollbar clear of card shadows
       *   - Negative margin trick not needed — gap handles spacing
       * Accessibility:
       *   - role="list" on the inner flex container for screen readers
       *   - tabIndex={-1} on container prevents an extra tab stop
       */}
      <div
        className="overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--color-tactical-border) transparent' }}
      >
        <div
          className="flex gap-4"
          role="list"
          aria-label="Wallet cards"
          style={{ minWidth: 'max-content' }}
        >
          {/* ---------------------------------------------------------------- */}
          {/* Total Balance Card — always first, wider anchor card            */}
          {/* ---------------------------------------------------------------- */}
          <div role="listitem" className="flex-shrink-0">
            <TotalBalanceCard />
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Individual Wallet Cards                                          */}
          {/* ---------------------------------------------------------------- */}
          {wallets.map((wallet) => (
            <div key={wallet.id} role="listitem" className="flex-shrink-0">
              <WalletCard
                wallet={wallet}
                isSelected={selectedWalletId === wallet.id}
                onSelect={(id) => {
                  if (selectedWalletId === id) {
                    // Toggle off → return to global view
                    clearWalletSelection();
                  } else {
                    selectWallet(id);
                  }
                }}
                onOpenSettings={openWalletSettings}
              />
            </div>
          ))}

          {/* ---------------------------------------------------------------- */}
          {/* Add Wallet Button                                                */}
          {/* ---------------------------------------------------------------- */}
          <div role="listitem" className="flex-shrink-0 self-stretch">
            <AddWalletButton
              onAdd={openAddWallet}
              isLocked={isAtWalletLimit}
              currentCount={wallets.length}
              maxCount={featureUnlocks.max_wallets}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

