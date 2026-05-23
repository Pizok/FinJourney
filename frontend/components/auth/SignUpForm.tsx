'use client';
// components/auth/SignUpForm.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock } from 'lucide-react';
import { signUpSchema, SignUpFormValues } from './schemas';
import { Button }                         from '@/components/ui/button';
import { Input }                          from '@/components/ui/input';
import { Label, FieldError, SectionTag }  from '@/components/ui/label';

interface SignUpFormProps {
  onSuccess: (email: string) => void;
  onSwitchToLogin: () => void;
}

export default function SignUpForm({ onSuccess, onSwitchToLogin }: SignUpFormProps) {
  const [loading, setLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange',
  });

  const onSubmit = async (values: SignUpFormValues) => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    onSuccess(values.email);
  };

  return (
    <div className="flex flex-col gap-10">

      {/* ── Header ─────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <SectionTag>Register</SectionTag>
        <h1 className="font-display font-semibold text-3xl text-pearl-text tracking-tight">
          Start Your Journey
        </h1>
        <p className="font-sans text-sm text-muted-text leading-relaxed max-w-sm">
          Create your account to begin tracking your real spending, build better
          habits, and see your financial progress over time.
        </p>
      </div>

      {/* ── Form ───────────────────────────────── */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
        noValidate
      >
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            icon={<Mail size={16} />}
            error={!!errors.email}
            {...register('email')}
          />
          <FieldError message={errors.email?.message} />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            icon={<Lock size={16} />}
            error={!!errors.password}
            {...register('password')}
          />
          <FieldError message={errors.password?.message} />
        </div>

        {/* Confirm Password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Repeat your password"
            autoComplete="new-password"
            icon={<Lock size={16} />}
            error={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
          <FieldError message={errors.confirmPassword?.message} />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!isValid}
          loading={loading}
        >
          Create Account
        </Button>
      </form>

      {/* ── Footer ─────────────────────────────── */}
      <p className="text-center font-sans text-sm text-muted-text">
        Already have an account?{' '}
        <button
          onClick={onSwitchToLogin}
          className="text-muted-emerald hover:text-pearl-text underline-offset-4 hover:underline font-medium bg-transparent border-none cursor-pointer transition-colors duration-200"
        >
          Sign In
        </button>
      </p>

    </div>
  );
}
