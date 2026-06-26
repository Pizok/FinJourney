// ─── FixedCostBreakdownModal.tsx ──────────────────────────────────────────────
// Read-only transparency view of how the Fixed Costs total is composed.
//
// Data fetching:
//   • Lazy — GET /api/v1/settings/fixed-costs fires only when this modal opens,
//     not on page load (settings_data_contract.md: "Lazy-loaded when opening
//     the breakdown modal").
//   • TanStack Query key: ['settings', 'fixed-costs']
//   • staleTime: 300s — in sync with the global settings staleTime
//   • No polling; the data changes only when the user edits loans/categories
//     in the Wallet Manager (a separate route).
//
// Ledger layout:
//   Each line renders as: [Label] [dot leader] [Amount]
//   The dot leader is a flex-1 spacer with border-b border-dotted — pure CSS,
//   no pseudo-elements, fully accessible (aria-hidden on the spacer).
//
// Usage:
//   <FixedCostBreakdownModal onClose={() => setOpen(false)} />
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Modal } from '../../ui/Modal'
import type { FixedCostsBreakdown, FixedCostItem } from '../types/settings.types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FixedCostBreakdownModalProps {
  onClose: () => void
}

// ─── Query ────────────────────────────────────────────────────────────────────

export const FIXED_COSTS_QUERY_KEY = ['settings', 'fixed-costs'] as const

async function fetchFixedCosts(): Promise<FixedCostsBreakdown> {
  const res = await fetch('/api/v1/settings/fixed-costs', {
    credentials: 'include',
  })

  if (!res.ok) {
    throw new Error(`Failed to load fixed costs (${res.status})`)
  }

  const json = await res.json()

  if (!json.success) {
    throw new Error(json.error?.message ?? 'Could not load fixed cost breakdown.')
  }

  return json.data as FixedCostsBreakdown
}

// ─── Formatters ───────────────────────────────────────────────────────────────

/**
 * Formats a number as Indonesian Rupiah with period-separated thousands.
 * Example: 1500000 → "Rp 1.500.000"
 * Uses `id-ID` locale formatting then replaces commas with dots to match
 * the project's Rupiah convention from the PRD.
 */
function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

// ─── LedgerRow ────────────────────────────────────────────────────────────────
// Single line in the breakdown ledger.
// Visual pattern: [Label] ........ [Amount]
//
// The dot leader is a flex-1 span with `border-b border-dotted` at a low
// opacity. It sits between label and amount and is aria-hidden to prevent
// screen readers from announcing a run of dots.

interface LedgerRowProps {
  label: string
  amount: number
  /** When true renders label and amount in pearl-text instead of muted-text */
  emphasised?: boolean
}

function LedgerRow({ label, amount, emphasised = false }: LedgerRowProps) {
  const textClass = emphasised
    ? 'text-pearl-text font-medium'
    : 'text-muted-text'

  return (
    <div className="flex items-baseline gap-2">
      {/* Label */}
      <span className={['font-sans text-sm shrink-0', textClass].join(' ')}>
        {label}
      </span>

      {/* Dot leader */}
      <span
        aria-hidden="true"
        className="mb-[3px] flex-1 border-b border-dotted border-tactical-border/50"
      />

      {/* Amount */}
      <span
        className={[
          'font-sans text-sm tabular-nums shrink-0',
          textClass,
        ].join(' ')}
      >
        {formatRupiah(amount)}
      </span>
    </div>
  )
}

// ─── SectionHeading ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-muted-text">
      {children}
    </p>
  )
}

// ─── SkeletonLedgerRow ────────────────────────────────────────────────────────

function SkeletonLedgerRow({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        aria-hidden="true"
        className={[
          'h-3.5 animate-pulse rounded bg-tactical-border/40',
          wide ? 'w-36' : 'w-24',
        ].join(' ')}
      />
      <span className="mb-[3px] flex-1 border-b border-dotted border-tactical-border/20" aria-hidden="true" />
      <span
        aria-hidden="true"
        className="h-3.5 w-24 animate-pulse rounded bg-tactical-border/40"
      />
    </div>
  )
}

// ─── LoadingState ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="px-6 py-5" aria-label="Loading fixed costs…" aria-busy="true">
      {/* Loans skeleton */}
      <div className="mb-5">
        <div className="mb-3 h-2.5 w-12 animate-pulse rounded bg-tactical-border/40" />
        <div className="flex flex-col gap-3">
          <SkeletonLedgerRow wide />
          <SkeletonLedgerRow />
        </div>
      </div>

      <div className="my-4 border-t border-tactical-border/60" aria-hidden="true" />

      {/* Categories skeleton */}
      <div className="mb-5">
        <div className="mb-3 h-2.5 w-20 animate-pulse rounded bg-tactical-border/40" />
        <div className="flex flex-col gap-3">
          <SkeletonLedgerRow wide />
          <SkeletonLedgerRow />
          <SkeletonLedgerRow wide />
          <SkeletonLedgerRow />
        </div>
      </div>

      <div className="my-4 border-t border-tactical-border/60" aria-hidden="true" />

      {/* Total skeleton */}
      <div className="flex items-baseline gap-2">
        <span className="h-4 w-12 animate-pulse rounded bg-tactical-border/50" aria-hidden="true" />
        <span className="mb-[3px] flex-1 border-b border-dotted border-tactical-border/20" aria-hidden="true" />
        <span className="h-4 w-28 animate-pulse rounded bg-tactical-border/50" aria-hidden="true" />
      </div>
    </div>
  )
}

// ─── ErrorState ───────────────────────────────────────────────────────────────

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="px-6 py-8 text-center" role="alert">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-terracotta/10">
        <AlertTriangle
          className="text-terracotta"
          size={18}
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>
      <p className="font-sans text-sm font-medium text-pearl-text">
        Could not load breakdown
      </p>
      <p className="mt-1 font-sans text-xs leading-relaxed text-muted-text">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={[
          'mx-auto mt-4 flex items-center gap-2 rounded-lg border border-tactical-border',
          'px-4 py-2 font-sans text-sm font-medium text-pearl-text',
          'transition-colors duration-150 hover:bg-pearl-text/5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald',
        ].join(' ')}
      >
        <RefreshCw size={13} strokeWidth={2} aria-hidden="true" />
        Try again
      </button>
    </div>
  )
}

// ─── EmptySection ─────────────────────────────────────────────────────────────

function EmptySection({ label }: { label: string }) {
  return (
    <p className="font-sans text-xs italic text-muted-text/60">
      No {label} configured.
    </p>
  )
}

// ─── BreakdownContent ─────────────────────────────────────────────────────────

function BreakdownContent({ data }: { data: FixedCostsBreakdown }) {
  const hasLoans = data.loans.length > 0
  const hasCategories = data.fixed_categories.length > 0

  return (
    <div className="px-6 py-5">

      {/* ── Loans section ─────────────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="mb-3">
          <SectionHeading>Loans</SectionHeading>
        </div>

        {hasLoans ? (
          <div className="flex flex-col gap-3">
            {data.loans.map((item: FixedCostItem) => (
              <LedgerRow key={item.name} label={item.name} amount={item.amount} />
            ))}
          </div>
        ) : (
          <EmptySection label="active loans" />
        )}
      </div>

      <div
        className="my-4 border-t border-tactical-border/60"
        aria-hidden="true"
      />

      {/* ── Fixed categories section ───────────────────────────────────────── */}
      <div className="mb-5">
        <div className="mb-3">
          <SectionHeading>Fixed Categories</SectionHeading>
        </div>

        {hasCategories ? (
          <div className="flex flex-col gap-3">
            {data.fixed_categories.map((item: FixedCostItem) => (
              <LedgerRow key={item.name} label={item.name} amount={item.amount} />
            ))}
          </div>
        ) : (
          <EmptySection label="fixed categories" />
        )}
      </div>

      {/* ── Total footer ──────────────────────────────────────────────────────
          The PRD specifies: "Total ........... Rp [Sum]"
          The dot leader renders this idiom exactly.
      */}
      <div
        className="border-t border-tactical-border pt-4"
        role="contentinfo"
        aria-label={`Total fixed costs: ${formatRupiah(data.total)}`}
      >
        <LedgerRow label="Total" amount={data.total} emphasised />
      </div>
    </div>
  )
}

// ─── FixedCostBreakdownModal ──────────────────────────────────────────────────

export function FixedCostBreakdownModal({ onClose }: FixedCostBreakdownModalProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: FIXED_COSTS_QUERY_KEY,
    queryFn: fetchFixedCosts,
    // Modal is rendered conditionally — query fires lazily on mount
    staleTime: 300_000,
    // Don't retry automatically on 4xx — surface the error immediately
    retry: (failureCount, err) => {
      const msg = err instanceof Error ? err.message : ''
      const is4xx = /\(4\d\d\)/.test(msg)
      return !is4xx && failureCount < 2
    },
  })

  // ── Footer note ────────────────────────────────────────────────────────────
  // Read-only transparency view: editing is done in the Wallet Manager.
  const footer = (
    <p className="font-sans text-xs leading-relaxed text-muted-text">
      Fixed costs are calculated from your active loans and fixed-budget
      categories.{' '}
      <span className="text-pearl-text">
        To edit them, use the Wallet Manager.
      </span>
    </p>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={true}
      title="Fixed Costs Breakdown"
      onClose={onClose}
      size="md"
    >
      <Modal.Header>
        <h2 className="font-display text-lg font-semibold text-pearl-text">
          Fixed Costs Breakdown
        </h2>
      </Modal.Header>
      
      <Modal.Body>
        {isLoading && <LoadingState />}

        {isError && (
          <ErrorState
            message={
              error instanceof Error
                ? error.message
                : 'Something went wrong loading the breakdown.'
            }
            onRetry={() => refetch()}
          />
        )}

        {data && <BreakdownContent data={data} />}
      </Modal.Body>
      
      <Modal.Footer>{footer}</Modal.Footer>
    </Modal>
  )
}
