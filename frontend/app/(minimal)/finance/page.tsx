// =============================================================================
// app/(minimal)/wallet/page.tsx — FinJourney Wallet Page
//
// Next.js App Router Server Component.
//
// Role of this file:
//   This is the entry point. It is a React Server Component (no "use client").
//   Its only job is to optionally fetch initial data on the server, then
//   pass it to <WalletShell /> — the Client Component that owns all
//   interactivity, Zustand state, and child rendering.
//
// Why server-side fetch?
//   Fetching on the server eliminates the blank-then-skeleton flash that
//   occurs when data is fetched client-side. The user receives a fully-
//   populated page on first load rather than waiting for a client round-trip.
//
// Current state (Part 1 — Foundation):
//   The real fetch is drafted but commented out. <WalletShell /> receives no
//   initialData prop and falls back to MOCK_WALLET_BOOTSTRAP automatically.
//
// To activate server-side hydration (Part 2):
//   1. Uncomment the fetch block.
//   2. Add initialData to <WalletShell initialData={initialData} />.
//   3. In WalletShell, call hydrate(initialData) instead of hydrateMock()
//      when initialData is not null.
// =============================================================================

import type { Metadata } from 'next';
import { redirect }      from 'next/navigation';
import type { WalletBootstrapResponse } from '@/components/finance/types/wallet.types';
import { WalletShell } from '@/components/finance/layout/WalletShell';
import { apiFetchServer } from '@/lib/apiClient.server';

// ─────────────────────────────────────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Finance — FinJourney',
  description:
    'Manage balances, transactions, budgets, and financial obligations.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default async function WalletPage() {

  // SERVER-SIDE BOOTSTRAP FETCH (Part 2)
  // ===========================================================================

  const initialData = await apiFetchServer('wallets/bootstrap', {
    next: { revalidate: 60 } // optional, depending on how often data changes
  }) as WalletBootstrapResponse | null;

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return <WalletShell initialData={initialData} />;
}

