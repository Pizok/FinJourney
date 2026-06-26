'use client'

/**
 * SavingsGoalModal.tsx
 *
 * Triggered by: "Manage Savings Goals" button in AssetHealthCard.
 * Store key: isSavingsTargetOpen / closeSavingsTarget
 *
 * Scope constraint (analytics_data_contract.md):
 *   Only one active savings target is supported. Saving a new goal
 *   replaces the current one. This is communicated clearly in the UI.
 *
 * Form fields:
 *   - Goal Name   (text, required, max 100 chars)
 *   - Target Amount (number, required, > 0, integer IDR)
 *   - Target Date (date, required, must be in the future)
 *
 * Validation: React Hook Form + Zod via @hookform/resolvers/zod.
 *   All field-level errors display inline below the input.
 *   The Save button is disabled while invalid or submitting.
 *
 * API note:
 *   Submits to /api/v1/analytics/savings-target (POST = create, with
 *   upsert semantics on the backend given the single-target constraint).
 *   Section refresh: asset_health (savings_target_progress updates).
 *
 * Canonical path: components/analytics/modals/SavingsGoalModal.tsx
 */

import { useEffect, useRef, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, CheckCircle, AlertCircle, Target, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { apiFetchClient } from '@/lib/apiClient.client'

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const savingsGoalSchema = z.object({
  name: z
    .string()
    .min(1, 'Goal name is required.')
    .max(100, 'Goal name must be 100 characters or fewer.'),

  amount: z.preprocess((val) => {
    if (typeof val === 'string') return Number(val.replace(/\D/g, ''))
    return Number(val)
  }, z.coerce
    .number()
    .int('Amount must be a whole number.')
    .positive('Amount must be greater than zero.')
  ),

  deadline: z
    .string()
    .min(1, 'Target date is required.')
    .refine((val) => {
      const chosen = new Date(val)
      const today  = new Date()
      today.setHours(0, 0, 0, 0)
      return !isNaN(chosen.getTime()) && chosen > today
    }, 'Target date must be in the future.'),
})

type SavingsGoalFormData = z.infer<typeof savingsGoalSchema>

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const first = contentRef.current?.querySelector<HTMLElement>(
      'input, button, [tabindex]:not([tabindex="-1"])',
    )
    first?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-abyssal-slate/80" onClick={onClose} aria-hidden="true" />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="animate-fade-in relative z-10 w-full max-w-lg rounded-xl border border-tactical-border bg-canvas-surface"
      >
        {children}
      </div>
    </div>
  )
}

// ─── Field ────────────────────────────────────────────────────────────────────

interface FieldProps {
  id:       string
  label:    string
  error?:   string
  hint?:    string
  children: React.ReactNode
}

function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-sans text-sm font-medium text-muted-text">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="font-sans text-xs text-muted-text/60">{hint}</p>
      )}
      {error && (
        <p className="font-sans text-xs text-terracotta" role="alert">{error}</p>
      )}
    </div>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────

const inputBase = cn(
  'w-full rounded-lg border border-tactical-border bg-abyssal-slate px-4 py-2.5',
  'font-sans text-sm text-pearl-text placeholder:text-muted-text/40',
  'focus:border-muted-emerald/50 focus:outline-none transition-colors duration-150',
)

function inputClass(hasError?: boolean) {
  return cn(inputBase, hasError && 'border-terracotta/50 focus:border-terracotta/50')
}

// ─── Success State ────────────────────────────────────────────────────────────

function SuccessState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-dawn-gold/15">
        <Target className="h-6 w-6 text-dawn-gold" strokeWidth={2} />
      </div>
      <div className="space-y-1">
        <p className="font-display text-base font-semibold text-pearl-text">
          Savings Goal Saved
        </p>
        <p className="font-sans text-sm leading-relaxed text-muted-text">
          Your savings target has been updated. Progress will be reflected
          in your Asset Health section.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className={cn(
          'mt-2 rounded-lg border border-tactical-border px-5 py-2.5',
          'font-display text-sm font-medium text-muted-text',
          'transition-colors duration-150 hover:text-pearl-text',
        )}
      >
        Close
      </button>
    </div>
  )
}

// ─── Modal Body ───────────────────────────────────────────────────────────────

function ModalBody({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()

  const [isSuccess,    setIsSuccess   ] = useState(false)
  const [submitError,  setSubmitError ] = useState<string | null>(null)

  // Minimum date: tomorrow in YYYY-MM-DD format
  const minDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }, [])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SavingsGoalFormData>({
    resolver: zodResolver(savingsGoalSchema) as any,
    defaultValues: { name: '', amount: undefined, deadline: '' },
  })

  // Live amount preview for user feedback
  const watchedAmount = watch('amount')
  const formattedAmount =
    watchedAmount && !isNaN(Number(watchedAmount)) && Number(watchedAmount) > 0
      ? formatCurrency(Number(watchedAmount))
      : null

  const mutation = useMutation({
    mutationFn: async (data: SavingsGoalFormData) => {
      return await apiFetchClient('analytics/savings-target', {
        method: 'POST',
        body: JSON.stringify({
          name:     data.name.trim(),
          amount:   data.amount,
          deadline: data.deadline,
        }),
      })
    },
    onSuccess: () => {
      setIsSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['analytics', 'overview'] })
      setTimeout(onClose, 2_000)
    },
    onError: (e: any) => {
      setSubmitError(e instanceof Error ? e.message : 'An unexpected error occurred.')
    },
  })

  function onSubmit(data: SavingsGoalFormData) {
    setSubmitError(null)
    mutation.mutate(data)
  }

  if (isSuccess) return <SuccessState onClose={onClose} />

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 border-b border-tactical-border p-6">
        <div className="space-y-0.5">
          <h2 id="modal-title" className="font-display text-lg font-semibold text-pearl-text">
            Manage Savings Goal
          </h2>
          <p className="font-sans text-sm text-muted-text">
            Create or update savings targets to track progress toward future
            objectives.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-tactical-border text-muted-text transition-colors hover:text-pearl-text"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* ── Form fields ─────────────────────────────────────────────────── */}
      <div className="space-y-5 p-6">

        {/* Goal Name */}
        <Field id="goal-name" label="Goal Name" error={errors.name?.message}>
          <input
            id="goal-name"
            type="text"
            placeholder="Emergency Fund"
            autoComplete="off"
            className={inputClass(!!errors.name)}
            {...register('name')}
          />
        </Field>

        {/* Target Amount */}
        <Field
          id="goal-amount"
          label="Target Amount"
          error={errors.amount?.message}
          hint={formattedAmount ? `= ${formattedAmount}` : undefined}
        >
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-sans text-sm text-muted-text">
              Rp
            </span>
            <input
              id="goal-amount"
              type="text"
              inputMode="numeric"
              placeholder="10.000.000"
              className={cn(inputClass(!!errors.amount), 'pl-10')}
              {...register('amount', {
                onChange: (e) => {
                  const rawValue = e.target.value.replace(/\D/g, '')
                  const formatted = rawValue ? parseInt(rawValue, 10).toLocaleString('id-ID') : ''
                  e.target.value = formatted
                }
              })}
            />
          </div>
        </Field>

        {/* Target Date */}
        <Field id="goal-deadline" label="Target Date" error={errors.deadline?.message}>
          <input
            id="goal-deadline"
            type="date"
            min={minDate}
            className={cn(inputClass(!!errors.deadline), 'cursor-pointer')}
            {...register('deadline')}
          />
        </Field>

        {/* Single-target scope notice */}
        <div className="flex items-start gap-2.5 rounded-lg border border-tactical-border/50 bg-abyssal-slate/40 p-3">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-text/60"
            strokeWidth={2}
            aria-hidden="true"
          />
          <p className="font-sans text-xs leading-relaxed text-muted-text">
            Only one active savings goal is supported at this time. Saving a
            new goal will replace the current one.
          </p>
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-terracotta/20 bg-terracotta/8 p-3">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
              strokeWidth={2}
            />
            <p className="font-sans text-sm text-terracotta">{submitError}</p>
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 border-t border-tactical-border p-6">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'rounded-lg border border-tactical-border px-5 py-2.5',
            'font-display text-sm font-medium text-muted-text',
            'transition-colors duration-150 hover:text-pearl-text',
          )}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className={cn(
            'rounded-lg bg-muted-emerald px-5 py-2.5',
            'font-display text-sm font-semibold text-pearl-text',
            'transition-colors duration-150 hover:bg-muted-emerald/90',
            'disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          {mutation.isPending ? 'Saving…' : 'Save Goal'}
        </button>
      </div>
    </form>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SavingsGoalModal() {
  const isOpen  = useAnalyticsStore((s) => s.isSavingsTargetOpen)
  const onClose = useAnalyticsStore((s) => s.closeSavingsTarget)

  if (!isOpen) return null

  return (
    <ModalShell onClose={onClose}>
      <ModalBody onClose={onClose} />
    </ModalShell>
  )
}
