// ─── FinancialBaselinesCard.tsx ──────────────────────────────────────────────
// Card 2: Financial Assumptions
//
// Controls:
//   • MonthlyIncomeInput     — editable currency input
//   • SavingsAllocationInput — editable currency input, real-time validated
//   • FixedCostSummary       — read-only total + breakdown trigger
//   • ProjectedBudgetCard    — read-only, recalculated instantly client-side
//   • OpenWalletManagerButton — ghost button → /wallet (loans/categories live there)
//
// PATCH /api/v1/settings/financials
//   Request:  { expected_monthly_income, monthly_savings_target }
//   Response: { success, projected_safe_daily_budget }
//   The backend value from the response should overwrite the locally-derived
//   preview on save (handled by markSaved() in the store).
//
// Impossible Budget Validation (settings_prd.md §4.3):
//   Savings > (Income - Fixed Costs) → SavingsAllocationInput outlined in
//   --terracotta, exact-math error shown below the input, and the global
//   [Save Changes] button is disabled via selectHasBlockingValidationErrors
//   (wired in UnsavedChangesBar).
//
// Formula reference (logic.md):
//   projected_safe_daily_budget = (income - fixed_costs - savings) / 30
//   This is computed live by updateFinancials() in the store — this card
//   only reads the result.
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useId, useState } from 'react'
import { AlertTriangle, ArrowRight, ChevronRight, Wallet } from 'lucide-react'
import {
  useSettingsStore,
  selectCurrentFinancials,
  selectSavingsValidationError,
} from '../store/settingsStore'
import { FixedCostBreakdownModal } from '../modals/FixedCostBreakdownModal'

// ─── Formatters ───────────────────────────────────────────────────────────────

/** Formats a number as "Rp 10.000.000" using Indonesian thousands separators. */
function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`
}

/** Strips everything except digits — used while parsing currency input. */
function parseDigits(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, '')
  return digitsOnly === '' ? 0 : parseInt(digitsOnly, 10)
}

// ─── CurrencyInput ────────────────────────────────────────────────────────────
// Shared pattern for MonthlyIncomeInput and SavingsAllocationInput.
//
// Displays a fixed "Rp" prefix inside the input bounds and formats the value
// with period-separated thousands on every keystroke. The cursor naturally
// lands at the end of the formatted string since digits are appended/removed
// from the right in normal typing — no manual caret management needed for
// the common case of typing left-to-right.

interface CurrencyInputProps {
  id: string
  value: number
  onChange: (value: number) => void
  /** When true, applies the terracotta error border + ring. */
  hasError?: boolean
  'aria-describedby'?: string
}

function CurrencyInput({
  id,
  value,
  onChange,
  hasError = false,
  'aria-describedby': ariaDescribedBy,
}: CurrencyInputProps) {
  return (
    <div className="relative">
      {/* Fixed "Rp" prefix */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-sans text-sm text-muted-text"
      >
        Rp
      </span>

      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value.toLocaleString('id-ID')}
        onChange={(e) => onChange(parseDigits(e.target.value))}
        aria-describedby={ariaDescribedBy}
        aria-invalid={hasError ? true : undefined}
        className={[
          'w-full rounded-lg border bg-abyssal-slate py-2.5 pl-9 pr-3',
          'font-sans text-sm tabular-nums text-pearl-text',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-1',
          hasError
            ? 'border-terracotta ring-1 ring-terracotta/20 focus:border-terracotta focus:ring-terracotta/30'
            : 'border-tactical-border focus:border-muted-emerald/60 focus:ring-muted-emerald/30',
        ].join(' ')}
      />
    </div>
  )
}

// ─── FieldLabel / HelperText ──────────────────────────────────────────────────
// Mirrors ProfileCard's pattern for visual consistency across cards.

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block font-sans text-xs font-medium text-muted-text"
    >
      {children}
    </label>
  )
}

// ─── MonthlyIncomeInput ───────────────────────────────────────────────────────

function MonthlyIncomeInput({
  value,
  onChange,
}: {
  value: number
  onChange: (val: number) => void
}) {
  const id = useId()

  return (
    <div>
      <FieldLabel htmlFor={id}>Expected Monthly Income</FieldLabel>
      <CurrencyInput id={id} value={value} onChange={onChange} />
      <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted-text">
        Your baseline income assumption. Recalculates the Daily Budget for
        the current month.
      </p>
    </div>
  )
}

// ─── SavingsAllocationInput ───────────────────────────────────────────────────

function SavingsAllocationInput({
  value,
  onChange,
  validationError,
}: {
  value: number
  onChange: (val: number) => void
  validationError: string | null
}) {
  const id = useId()
  const errorId = useId()

  return (
    <div>
      <FieldLabel htmlFor={id}>Monthly Savings Allocation</FieldLabel>
      <CurrencyInput
        id={id}
        value={value}
        onChange={onChange}
        hasError={!!validationError}
        aria-describedby={validationError ? errorId : undefined}
      />

      {validationError ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 font-sans text-xs leading-relaxed text-terracotta"
        >
          <AlertTriangle
            className="mt-0.5 shrink-0"
            size={12}
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>{validationError}</span>
        </p>
      ) : (
        <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted-text">
          How much you plan to set aside each month before discretionary
          spending.
        </p>
      )}
    </div>
  )
}

// ─── FixedCostSummary ─────────────────────────────────────────────────────────

function FixedCostSummary({
  total,
  activeLoans,
  fixedCategories,
  onViewBreakdown,
}: {
  total: number
  activeLoans: number
  fixedCategories: number
  onViewBreakdown: () => void
}) {
  const id = useId()

  return (
    <div>
      <FieldLabel htmlFor={id}>Fixed Costs</FieldLabel>

      <div
        id={id}
        className="rounded-lg border border-tactical-border bg-abyssal-slate px-3 py-2.5"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-sans text-sm tabular-nums text-pearl-text">
            {formatRupiah(total)}
          </span>
          <span className="font-sans text-[11px] text-muted-text">
            per month
          </span>
        </div>

        {/* Details list */}
        <p className="mt-1 font-sans text-xs text-muted-text">
          • {activeLoans} Active Loan{activeLoans !== 1 ? 's' : ''} • {fixedCategories}{' '}
          Fixed Categor{fixedCategories !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      {/* View Breakdown action */}
      <button
        type="button"
        onClick={onViewBreakdown}
        className={[
          'mt-2 flex items-center gap-1 font-sans text-xs font-medium text-steel-violet',
          'transition-colors duration-150 hover:text-steel-violet/80',
          'focus-visible:outline-none focus-visible:underline',
        ].join(' ')}
      >
        View Breakdown
        <ChevronRight size={12} strokeWidth={2.5} aria-hidden="true" />
      </button>

      <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted-text">
        Calculated automatically from your active loans and fixed-budget
        categories. Read-only here.
      </p>
    </div>
  )
}

// ─── ProjectedBudgetCard ──────────────────────────────────────────────────────
// Read-only display of the locally-derived daily budget preview.
// Updates instantly as Income or Savings change (see updateFinancials in store).
//
// Visual treatment: this is the card's "hero metric", but per DESIGN.md /
// PRODUCT.md anti-patterns, it must NOT resemble a SaaS hero-metric template
// (big number + small label + gradient). Instead it sits inside the same
// flat surface as the rest of the card, distinguished only by the muted-emerald
// number color and a borderless inset panel — consistent with the HP/XP
// color language defined in DESIGN.md §7.

function ProjectedBudgetCard({ amount }: { amount: number }) {
  return (
    <div className="rounded-lg border border-tactical-border bg-abyssal-slate px-4 py-4">
      <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-muted-text">
        Projected Safe Daily Budget
      </p>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-muted-emerald">
        {formatRupiah(amount)}
        <span className="ml-1.5 font-sans text-sm font-normal text-muted-text">
          / day
        </span>
      </p>
      <p className="mt-2 font-sans text-xs leading-relaxed text-muted-text">
        (Income − Fixed Costs − Savings) ÷ 30. Recalculates instantly as you
        edit the fields above — the saved value is confirmed by the server
        when you save.
      </p>
    </div>
  )
}

// ─── OpenWalletManagerButton ──────────────────────────────────────────────────
// Secondary ghost button navigating to the Wallet domain, where loans and
// fixed categories are actually edited (Fixed Costs here are read-only).

function OpenWalletManagerButton() {
  return (
    <a
      href="/wallet"
      className={[
        'flex w-full items-center justify-center gap-2 rounded-lg',
        'border border-tactical-border px-4 py-2.5',
        'font-sans text-sm font-medium text-pearl-text',
        'transition-colors duration-150',
        'hover:border-pearl-text/30 hover:bg-pearl-text/5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface',
        'sm:w-auto',
      ].join(' ')}
    >
      Open Wallet Manager
      <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
    </a>
  )
}

// ─── FinancialBaselinesCard ───────────────────────────────────────────────────

export function FinancialBaselinesCard() {
  const financials = useSettingsStore(selectCurrentFinancials)
  const updateFinancials = useSettingsStore((s) => s.updateFinancials)
  const validationError = useSettingsStore(selectSavingsValidationError)

  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)

  return (
    <>
      <section
        id="financials"
        aria-labelledby="financials-heading"
        className="rounded-xl border border-tactical-border bg-canvas-surface scroll-mt-32"
      >
        {/* Card Header */}
        <div className="border-b border-tactical-border px-8 py-6">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted-emerald/10"
              aria-hidden="true"
            >
              <Wallet className="text-muted-emerald" size={15} strokeWidth={2} />
            </div>
            <div>
              <h2
                id="financials-heading"
                className="font-display text-base font-semibold text-pearl-text"
              >
                Financial Assumptions
              </h2>
              <p className="mt-0.5 font-sans text-sm text-muted-text">
                Powers the Daily Budget calculation on your Journey dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="flex flex-col gap-6 px-8 py-6">
          {/* Income + Savings — two columns on desktop */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <MonthlyIncomeInput
              value={financials.expected_monthly_income}
              onChange={(expected_monthly_income) =>
                updateFinancials({ expected_monthly_income })
              }
            />
            <SavingsAllocationInput
              value={financials.monthly_savings_target}
              onChange={(monthly_savings_target) =>
                updateFinancials({ monthly_savings_target })
              }
              validationError={validationError}
            />
          </div>

          <div className="border-t border-tactical-border/60" aria-hidden="true" />

          {/* Fixed Costs + Projected Budget — two columns on desktop */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FixedCostSummary
              total={financials.fixed_costs.total}
              activeLoans={financials.fixed_costs.active_loans}
              fixedCategories={financials.fixed_costs.fixed_categories}
              onViewBreakdown={() => setIsBreakdownOpen(true)}
            />
            <ProjectedBudgetCard amount={financials.projected_safe_daily_budget} />
          </div>

          <div className="border-t border-tactical-border/60" aria-hidden="true" />

          {/* Wallet Manager link */}
          <div className="flex flex-col gap-2">
            <OpenWalletManagerButton />
            <p className="font-sans text-xs text-muted-text">
              To edit individual loans or fixed categories, manage them from
              the Wallet domain.
            </p>
          </div>
        </div>
      </section>

      {/* Lazy-loaded breakdown modal */}
      {isBreakdownOpen && (
        <FixedCostBreakdownModal onClose={() => setIsBreakdownOpen(false)} />
      )}
    </>
  )
}
