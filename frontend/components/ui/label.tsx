'use client';
// components/ui/label.tsx
import * as React from 'react';

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <label
    className={['block text-xs font-sans text-muted-text mb-1.5', className].join(' ')}
    {...props}
  >
    {children}
  </label>
);

// FieldError — validation message in Terracotta beneath inputs.
export const FieldError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-sans text-terracotta">{message}</p>
  );
};

// SectionTag — small uppercase label; color contrast only, no decorative underline.
export const SectionTag: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <span className="inline-block text-xs font-display font-semibold text-muted-emerald tracking-widest uppercase mb-4">
    {children}
  </span>
);

// Tooltip — supporting hint beneath inputs.
export const Tooltip: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <p className="mt-1.5 text-xs font-sans text-muted-text leading-relaxed">
    {children}
  </p>
);
