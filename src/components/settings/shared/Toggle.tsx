// ─── Toggle.tsx ───────────────────────────────────────────────────────────────
// Accessible toggle switch shared across PreferencesCard and
// NotificationSettingsCard.
//
// Track:  w-9 (36px) × h-5 (20px)
// Thumb:  w-3.5 (14px) × h-3.5 (14px)
// Off:    thumb at translate-x-[3px]   → 3px gap from left edge
// On:     thumb at translate-x-[19px]  → 36 − 14 − 3 = 19px from left edge
//
// Design:
//   • checked  → bg-muted-emerald
//   • unchecked → bg-tactical-border
//   • no outer glow — consistent with DESIGN.md button rules
// ─────────────────────────────────────────────────────────────────────────────

'use client'

interface ToggleProps {
  /** Controlled checked state. */
  checked: boolean
  /** Called with the new boolean when the user toggles. */
  onChange: (checked: boolean) => void
  disabled?: boolean
  /**
   * The `id` that a sibling `<label>` uses as its `htmlFor`.
   * When supplied the toggle becomes the labelled control.
   */
  id?: string
  /** Fallback accessible label when no visible `<label>` exists. */
  'aria-label'?: string
  /** Placed after the accessible label in the accessibility tree. */
  'aria-describedby'?: string
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked)
      }}
      className={[
        // Track sizing + shape
        'relative inline-flex h-5 w-9 shrink-0 rounded-full',
        // Colour
        checked ? 'bg-muted-emerald' : 'bg-tactical-border',
        // Transitions
        'transition-colors duration-200 ease-out',
        // Focus ring — never a glow; ring only on keyboard focus
        'focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-muted-emerald',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface',
        // Disabled state
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Thumb */}
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white',
          'shadow-sm transition-transform duration-200 ease-out',
          checked ? 'translate-x-[19px]' : 'translate-x-[3px]',
        ].join(' ')}
      />
    </button>
  )
}
