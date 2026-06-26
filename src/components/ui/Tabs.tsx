'use client';

// =============================================================================
// components/ui/Tabs.tsx
//
// Bespoke Radix-backed Tabs primitive.
//
// Follows the same pattern as other bespoke UI primitives in this project
// (Progress.tsx, Modal.tsx) — wraps @radix-ui directly with project-specific
// styling rather than using the shadcn CLI.
//
// Design rules (DESIGN.md):
//   - TabsList: flat abyssal-slate bar, rounded-xl, no shadows
//   - TabsTrigger: muted-text inactive → pearl-text + muted-emerald underline active
//   - No glassmorphism, no outer glows on the tab strip itself
//   - Transitions: 150ms colour crossfade only
// =============================================================================

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

// ─── Root ─────────────────────────────────────────────────────────────────────

const Tabs = TabsPrimitive.Root;

// ─── TabsList ─────────────────────────────────────────────────────────────────

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className = '', ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={[
      'inline-flex items-end gap-1',
      'border-b border-[var(--color-tactical-border)]',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

// ─── TabsTrigger ──────────────────────────────────────────────────────────────

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className = '', ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={[
      // Layout & spacing
      'relative px-4 pb-3 pt-1',
      // Typography
      'font-sans text-sm font-medium',
      // Inactive state
      'text-[var(--color-muted-text)]',
      // Active state: pearl text + muted-emerald bottom border
      'data-[state=active]:text-[var(--color-pearl-text)]',
      // Active indicator — bottom glow line (matches SettingsTabs pattern)
      'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-full after:content-[""]',
      'data-[state=active]:after:bg-[var(--color-muted-emerald)]',
      'data-[state=inactive]:after:bg-transparent',
      // Hover
      'hover:text-[var(--color-pearl-text)]/80',
      // Transitions
      'transition-colors duration-150',
      // Focus
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-muted-emerald)]',
      'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-abyssal-slate)]',
      // Disabled
      'disabled:pointer-events-none disabled:opacity-40',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

// ─── TabsContent ──────────────────────────────────────────────────────────────

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className = '', ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={[
      // Hide inactive content when forceMount is used
      'data-[state=inactive]:hidden',
      // Focus ring for keyboard users navigating into tab content
      'focus-visible:outline-none',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

// ─── Exports ──────────────────────────────────────────────────────────────────

export { Tabs, TabsList, TabsTrigger, TabsContent };
