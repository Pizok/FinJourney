'use client';
// components/ui/input.tsx
import * as React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, icon, suffix, className = '', ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-4 text-muted-text pointer-events-none">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={[
            'w-full bg-canvas-surface text-pearl-text placeholder:text-muted-text',
            'border rounded-lg px-4 py-3 font-sans text-sm',
            'outline-none transition-colors duration-200',
            'focus:border-muted-emerald',
            error
              ? 'border-terracotta focus:border-terracotta'
              : 'border-tactical-border',
            icon   ? 'pl-11' : '',
            suffix ? 'pr-11' : '',
            className,
          ].join(' ')}
          {...props}
        />
        {suffix && (
          <span className="absolute right-4 text-muted-text pointer-events-none text-sm">
            {suffix}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
