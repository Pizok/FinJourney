'use client';
// components/ui/button.tsx
import * as React from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  // Solid fill — Muted Emerald reserved for primary actions only
  primary:
    'bg-muted-emerald text-abyssal-slate border border-muted-emerald ' +
    'hover:brightness-90 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',

  // Ghost — transparent with Tactical Border; subtle Pearl Text hover
  ghost:
    'bg-transparent text-pearl-text border border-tactical-border ' +
    'hover:border-pearl-text ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',

  // Danger — restrained; text + border only, no fill
  danger:
    'bg-transparent text-terracotta border border-terracotta ' +
    'hover:bg-terracotta/10 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      children,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          'inline-flex items-center justify-center gap-2',
          'rounded-lg font-display font-semibold',
          'transition-colors duration-200 cursor-pointer',
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(' ')}
        {...props}
      >
        {loading && (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
