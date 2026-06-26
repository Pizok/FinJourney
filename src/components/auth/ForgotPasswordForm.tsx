'use client';
// components/auth/ForgotPasswordForm.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { forgotPasswordSchema, ForgotPasswordFormValues } from './schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError, SectionTag } from '@/components/ui/label';

import { createBrowserClient } from '@supabase/ssr';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export default function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [apiError, setApiError] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setLoading(true);
    setApiError('');
    setSuccess(false);
    
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth?view=update-password')}`,
    });
    
    setLoading(false);
    
    if (error) {
      setApiError(error.message);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="flex flex-col gap-10">

      {/* ── Header ─────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <SectionTag>Recovery</SectionTag>
        <h1 className="font-display font-semibold text-3xl text-pearl-text tracking-tight">
          Forgot Password
        </h1>
        <p className="font-sans text-sm text-muted-text leading-relaxed max-w-sm">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      {/* ── Form ───────────────────────────────── */}
      {success ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-3">
            <p className="font-sans text-sm text-emerald-500">
              Check your email for the password reset link.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            variant="ghost"
            className="w-full"
            onClick={onBackToLogin}
          >
            Back to login
          </Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
          noValidate
          onChange={() => setApiError('')}
        >
          {/* Global API error */}
          {apiError && (
            <div className="rounded-lg border border-terracotta/40 bg-terracotta/5 px-4 py-3">
              <p className="font-sans text-sm text-terracotta">{apiError}</p>
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="forgot-email">Email address</Label>
            <Input
              id="forgot-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              icon={<Mail size={16} />}
              error={!!errors.email || !!apiError}
              {...register('email')}
            />
            <FieldError message={errors.email?.message} />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!isValid || loading}
            loading={loading}
          >
            Send Reset Link
          </Button>

          <Button
            type="button"
            size="lg"
            variant="ghost"
            className="w-full"
            onClick={onBackToLogin}
            disabled={loading}
          >
            Back to login
          </Button>
        </form>
      )}
    </div>
  );
}
