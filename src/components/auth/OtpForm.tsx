'use client';
// components/auth/OtpForm.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { otpSchema, OtpFormValues } from './schemas';
import { Button }             from '@/components/ui/button';
import { FieldError, SectionTag } from '@/components/ui/label';

const DEMO_OTP = '123456';

interface OtpFormProps {
  email: string;
  onSuccess: () => void;
}

export default function OtpForm({ email, onSuccess }: OtpFormProps) {
  const [loading,  setLoading]  = React.useState(false);
  const [resent,   setResent]   = React.useState(false);
  const [apiError, setApiError] = React.useState('');

  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [digits, setDigits]     = React.useState<string[]>(Array(6).fill(''));

  const {
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);
    setValue('code', next.join(''), { shouldValidate: true });
    setApiError('');
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next   = Array(6).fill('');
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setDigits(next);
    setValue('code', next.join(''), { shouldValidate: true });
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const onSubmit = async () => {
    const code = digits.join('');
    if (code.length < 6) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    if (code !== DEMO_OTP) {
      setApiError('Incorrect code. Please try again.');
      return;
    }
    onSuccess();
  };

  const handleResend = async () => {
    setResent(true);
    await new Promise((r) => setTimeout(r, 800));
    setTimeout(() => setResent(false), 3000);
  };

  const isComplete = digits.every(Boolean);

  return (
    <div className="flex flex-col gap-10">

      {/* ── Header ─────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <SectionTag>Verify</SectionTag>
        <h1 className="font-display font-semibold text-3xl text-pearl-text tracking-tight">
          Verify Your Access
        </h1>
        <p className="font-sans text-sm text-muted-text leading-relaxed max-w-sm">
          Enter the 6-digit code sent to{' '}
          <span className="text-pearl-text">{email}</span> to continue.{' '}
          <span className="text-muted-text">(Demo: 123456)</span>
        </p>
      </div>

      {/* ── OTP inputs ─────────────────────────── */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
        noValidate
      >
        <div className="flex gap-2 justify-between" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              aria-label={`Digit ${i + 1}`}
              className={[
                'w-12 h-14 text-center text-xl font-display font-semibold',
                'bg-canvas-surface border rounded-lg outline-none',
                'text-pearl-text transition-colors duration-200',
                'focus:border-muted-emerald',
                apiError
                  ? 'border-terracotta'
                  : d
                  ? 'border-muted-emerald/50'
                  : 'border-tactical-border',
              ].join(' ')}
            />
          ))}
        </div>

        {/* Errors */}
        {(apiError || errors.code?.message) && (
          <FieldError message={apiError || errors.code?.message} />
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!isComplete}
          loading={loading}
        >
          Verify &amp; Continue
        </Button>
      </form>

      {/* ── Resend ─────────────────────────────── */}
      <p className="text-center font-sans text-sm text-muted-text">
        <button
          onClick={handleResend}
          disabled={resent}
          className="text-muted-emerald hover:text-pearl-text underline-offset-4 hover:underline font-medium bg-transparent border-none cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resent ? 'Code resent!' : 'Resend email code'}
        </button>
      </p>

    </div>
  );
}
