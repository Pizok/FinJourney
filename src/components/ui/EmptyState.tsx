/**
 * components/ui/EmptyState.tsx
 *
 * Re-export barrel.
 *
 * The canonical EmptyState implementation lives at
 * @/components/journey/features/EmptyState — it was authored there because
 * it was built as part of the Journey section, but it imports Card and cn
 * which are shared utilities.
 *
 * Multiple journey feature components import from '@/components/ui/EmptyState',
 * so this barrel bridges the import path without moving the file.
 */

export { EmptyState } from '@/components/journey/features/EmptyState';
export type { EmptyStateProps } from '@/components/journey/features/EmptyState';
