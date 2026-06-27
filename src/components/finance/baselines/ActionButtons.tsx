import { Edit2, Trash2 } from 'lucide-react';

export function EditButton({ ariaLabel, onClick }: { ariaLabel: string, onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={[
        'shrink-0 rounded-md p-1.5 text-[var(--color-muted-text)]',
        'transition-colors duration-150',
        'hover:bg-[var(--color-muted-emerald)]/10 hover:text-[var(--color-muted-emerald)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-muted-emerald)]',
      ].join(' ')}
    >
      <Edit2 size={13} strokeWidth={2} />
    </button>
  );
}

export function RemoveButton({ onRemove, ariaLabel }: { onRemove: () => void, ariaLabel: string }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={ariaLabel}
      className={[
        'shrink-0 rounded-md p-1.5 text-[var(--color-muted-text)]',
        'transition-colors duration-150',
        'hover:bg-[var(--color-terracotta)]/10 hover:text-[var(--color-terracotta)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-terracotta)]',
      ].join(' ')}
    >
      <Trash2 size={13} strokeWidth={2} />
    </button>
  );
}
