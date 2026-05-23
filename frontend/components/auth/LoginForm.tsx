'use client';
// components/auth/LoginForm.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock } from 'lucide-react';
import { loginSchema, LoginFormValues } from './schemas';
import { Button }                        from '@/components/ui/button';
import { Input }                         from '@/components/ui/input';
import { Label, FieldError, SectionTag } from '@/components/ui/label';

interface LoginFormProps {
  onSuccess: () => void;
  onSwitchToSignUp: () => void;
}

export default function LoginForm({ onSuccess, onSwitchToSignUp }: LoginFormProps) {
  const [loading,  setLoading]  = React.useState(false);
  const [apiError, setApiError] = React.useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const onSubmit = async (_values: LoginFormValues) => {
    setLoading(true);
    setApiError('');
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    onSuccess();
  };

  return (
    <div className="flex flex-col gap-10">

      {/* ── Header ─────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <SectionTag>Access</SectionTag>
        <h1 className="font-display font-semibold text-3xl text-pearl-text tracking-tight">
          Welcome Back
        </h1>
        <p className="font-sans text-sm text-muted-text leading-relaxed max-w-sm">
          Continue your journey by checking your progress and logging new expenses.
        </p>
      </div>

      {/* ── Form ───────────────────────────────── */}
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
          <Label htmlFor="login-email">Email address</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            icon={<Mail size={16} />}
            error={!!errors.email || !!apiError}
            {...register('email')}
          />
          <FieldError message={errors.email?.message} />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            placeholder="Your password"
            autoComplete="current-password"
            icon={<Lock size={16} />}
            error={!!errors.password || !!apiError}
            {...register('password')}
          />
          <FieldError message={errors.password?.message} />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!isValid}
          loading={loading}
        >
          Sign In
        </Button>
      </form>

      {/* ── Footer ─────────────────────────────── */}
      <p className="text-center font-sans text-sm text-muted-text">
        New here?{' '}
        <button
          onClick={onSwitchToSignUp}
          className="text-muted-emerald hover:text-pearl-text underline-offset-4 hover:underline font-medium bg-transparent border-none cursor-pointer transition-colors duration-200"
        >
          Start your journey
        </button>
      </p>

    </div>
  );
}
