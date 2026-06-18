// =============================================================================
// components/ui/EmptyState.tsx
//
// Shared empty-state container used across all Journey sections.
//
// Design rules (DESIGN.md):
//   - Icon: lucide-react, size 28, strokeWidth 2, text-muted-text
//   - Message: font-sans, text-sm, text-muted-text, max-w-[36ch], centered
//   - Optional description: font-sans, text-xs, text-muted-text/70
//   - Optional action: ghost button (tactical-border, hover dawn-gold)
//   - Container: Card padding="lg", text-center
//   - No system emojis, no decorative elements
//
// Usage:
//   import { EmptyState } from "@/components/ui/EmptyState";
//   import { Trophy } from "lucide-react";
//
//   <EmptyState
//     icon={Trophy}
//     message="Your first review is being prepared."
//   />
//
//   <EmptyState
//     icon={BookOpen}
//     message="No story recorded."
//     description="Transactions you log will appear here over time."
//     action={{ label: "Log a transaction", onClick: () => router.push("/transactions") }}
//   />
// =============================================================================

import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  /**
   * Lucide icon component (not an element — the component itself).
   * EmptyState controls the size (28px) and strokeWidth (2) for consistency.
   * Example: icon={Globe}  NOT  icon={<Globe />}
   */
  icon: LucideIcon;
  /**
   * Primary message — short, sentence-case, no trailing period convention
   * is relaxed here since these are full sentences per the spec.
   */
  message: string;
  /**
   * Optional secondary description line — rendered below the message
   * in a lighter weight for elaboration.
   */
  description?: string;
  /**
   * Optional ghost action button — navigates or triggers an action.
   * Use sparingly: only when there is a clear, direct next step.
   */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional classes applied to the outer Card wrapper */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  message,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card
      padding="lg"
      className={cn("text-center", className)}
      data-testid="empty-state"
    >
      {/* Icon */}
      <Icon
        size={28}
        strokeWidth={2}
        className="text-muted-text mx-auto mb-4"
        aria-hidden="true"
      />

      {/* Primary message */}
      {/*
       * max-w-[36ch] keeps short empty-state messages from stretching too
       * wide on large cards — centres naturally within the text-center parent.
       */}
      <p
        className={cn(
          "font-sans text-sm text-muted-text leading-relaxed",
          "mx-auto max-w-[36ch]",
          description && "mb-2"
        )}
      >
        {message}
      </p>

      {/* Optional description */}
      {description && (
        <p className="font-sans text-xs text-muted-text/60 leading-relaxed mx-auto max-w-[42ch]">
          {description}
        </p>
      )}

      {/* Optional action button */}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            "mt-5 inline-flex items-center gap-2 px-4 py-2",
            "rounded-lg border border-tactical-border",
            "bg-transparent font-sans text-sm text-pearl-text",
            "hover:border-dawn-gold/60 transition-colors duration-200",
            "cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-muted-emerald focus-visible:ring-offset-2",
            "focus-visible:ring-offset-canvas-surface"
          )}
        >
          {action.label}
        </button>
      )}
    </Card>
  );
}
