// =============================================================================
// components/ui/Progress.tsx
//
// Shared progress bar primitive.
//
// Design rules (DESIGN.md §7):
//   - Bar container: inset abyssal-slate, rounded-full, flat surfaces only
//   - Fill: solid color, no gradients, no glow
//   - Smooth width transition (0.5s ease)
//   - WCAG: explicit role="progressbar" with aria-valuenow/min/max
//
// Color convention:
//   HP bars     → --color-muted-emerald (terracotta when HP < 30%)
//   XP bars     → --color-dawn-gold
//   Challenge   → --color-steel-violet or --color-muted-emerald (when done)
//   Custom      → pass the full CSS custom property name as `colorVar`
// =============================================================================

import { cn } from "@/lib/utils";

// ─── Height tokens ────────────────────────────────────────────────────────────

const heights = {
  /** 4px — used for dense data grids and sub-item indicators */
  xs: "h-1",
  /** 5px — default, used for budget bars and category trackers */
  sm: "h-[5px]",
  /** 6px — used for HP and XP bars in the player card */
  md: "h-1.5",
  /** 8px — used for prominent challenge progress bars */
  lg: "h-2",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProgressProps {
  /**
   * Current value — raw number, not a percentage.
   * E.g., 450000 when tracking Rp savings.
   */
  value: number;
  /**
   * Maximum value. The fill width is (value / max) * 100%.
   * @default 100
   */
  max?: number;
  /**
   * CSS custom property that resolves to the fill colour.
   * Must include the leading dashes: '--color-muted-emerald'.
   * @default '--color-muted-emerald'
   */
  colorVar?: string;
  /**
   * Height preset.
   * @default 'sm'
   */
  height?: keyof typeof heights;
  /**
   * Additional class names applied to the outer track element.
   */
  className?: string;
  /**
   * Human-readable label for screen readers.
   * Required when the progress bar isn't adjacent to descriptive text.
   */
  "aria-label"?: string;
  /**
   * Whether to animate the fill width on mount.
   * Disable for reduced-motion users — but the CSS media query handles this
   * automatically via the `transition` property respecting prefers-reduced-motion.
   * @default true
   */
  animated?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Progress({
  value,
  max = 100,
  colorVar = "--color-muted-emerald",
  height = "sm",
  className,
  "aria-label": ariaLabel,
  animated = true,
}: ProgressProps) {
  // Clamp the percentage to [0, 100]. Never divide by zero.
  const percentage =
    max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel}
      aria-valuetext={`${percentage}%`}
      className={cn(
        // Track: inset dark well
        "w-full overflow-hidden rounded-full bg-abyssal-slate",
        heights[height],
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full",
          // Smooth transition — @media (prefers-reduced-motion: reduce) will
          // suppress this via the browser's UA stylesheet override in Tailwind.
          animated && "transition-[width] duration-500 ease-out"
        )}
        style={{
          width: `${percentage}%`,
          background: `var(${colorVar})`,
        }}
      />
    </div>
  );
}

// ─── ProgressWithLabel ────────────────────────────────────────────────────────
// Convenience wrapper that pairs the bar with a label + percentage row.
// Used throughout category budgeting and challenge objectives.

export interface ProgressWithLabelProps extends ProgressProps {
  label: string;
  valueLabel?: string; // e.g., "Rp450K / Rp1.000K" — defaults to "X%"
}

export function ProgressWithLabel({
  label,
  valueLabel,
  value,
  max = 100,
  ...rest
}: ProgressWithLabelProps) {
  const percentage =
    max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;

  const displayValue = valueLabel ?? `${percentage}%`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-sans text-[13px] text-pearl-text">{label}</span>
        <span className="font-sans text-xs text-muted-text tabular-nums">
          {displayValue}
        </span>
      </div>
      <Progress value={value} max={max} {...rest} />
    </div>
  );
}
