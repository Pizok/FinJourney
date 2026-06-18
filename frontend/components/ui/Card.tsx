// =============================================================================
// components/ui/Card.tsx
//
// Shared surface container primitive.
//
// Design rules (DESIGN.md §5):
//   - flat surfaces only — no glassmorphism, no outer glows, no noisy gradients
//   - canvas-surface background (#1E293B)
//   - 1px tactical-border (#334155)
//   - rounded-lg or rounded-xl
//   - generous padding
//   - hover: subtle border transition only (never shadow)
// =============================================================================

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// ─── Variants ─────────────────────────────────────────────────────────────────

const padding = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

const radius = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Inner padding preset. Use 'none' when the card contains full-bleed
   * content (e.g., an image or artwork that extends to the card edges).
   * @default 'md'
   */
  padding?: keyof typeof padding;
  /**
   * Border radius preset.
   * @default 'xl'
   */
  radius?: keyof typeof radius;
  /**
   * When true, adds cursor-pointer, a hover border transition, and
   * focus-visible ring for keyboard accessibility.
   * Always pass an onClick or role="button" when using interactive.
   * @default false
   */
  interactive?: boolean;
  /**
   * Apply a danger-state border (terracotta) — used for HP-critical warnings.
   * @default false
   */
  danger?: boolean;
  /**
   * Apply an active/highlighted border (muted-emerald) — used when the
   * card represents the currently active region or active challenge.
   * @default false
   */
  active?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      padding: paddingProp = "md",
      radius: radiusProp = "xl",
      interactive = false,
      danger = false,
      active = false,
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          // ── Surface ─────────────────────────────────────────────────────
          "bg-canvas-surface",
          // ── Border ──────────────────────────────────────────────────────
          "border",
          danger
            ? "border-terracotta/50"
            : active
            ? "border-muted-emerald"
            : "border-tactical-border",
          // ── Shape ───────────────────────────────────────────────────────
          radius[radiusProp],
          // ── Padding ─────────────────────────────────────────────────────
          padding[paddingProp],
          // ── Interaction ─────────────────────────────────────────────────
          interactive && [
            "cursor-pointer",
            "transition-colors duration-200",
            // Hover: border lightens toward muted-emerald — never a shadow
            !danger && !active && "hover:border-muted-emerald/60",
            danger && "hover:border-terracotta",
            // Focus-visible ring for keyboard navigation (WCAG 2.4.7)
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-muted-emerald focus-visible:ring-offset-2",
            "focus-visible:ring-offset-abyssal-slate",
          ],
          className
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

// ─── Card.Header ──────────────────────────────────────────────────────────────
// Convenience sub-component for the top section of a card, with a bottom
// separator line. Not padded independently — inherits parent Card padding.

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  withBorder?: boolean;
}

export function CardHeader({
  className,
  withBorder = false,
  children,
  ...rest
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        withBorder && "border-b border-tactical-border pb-4 mb-4",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

// ─── Card.Row ─────────────────────────────────────────────────────────────────
// Utility layout row — flex, items-center, justify-between, used for
// label/value pairs and section sub-headers inside cards.

export function CardRow({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between gap-2", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
