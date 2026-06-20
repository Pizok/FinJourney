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

import { createBrowserClient } from '@supabase/ssr';
import { GoogleIcon } from './GoogleIcon';

interface SignUpFormProps {
  onSuccess: (email: string) => void;
  onSwitchToLogin: () => void;
}

export default function SignUpForm({ onSuccess, onSwitchToLogin }: SignUpFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [apiError, setApiError] = React.useState('');
  const [checkEmail, setCheckEmail] = React.useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
    setApiError('');
    
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });
    
    setLoading(false);
    
    if (error) {
      setApiError(error.message);
    } else {
      // If we require email confirmation, session might be null.
      if (!data.session) {
        setCheckEmail(true);
      } else {
        onSuccess(values.email);
      }
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setApiError('');
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    
    if (error) {
      setLoading(false);
      setApiError(error.message);
    }
  };

  if (checkEmail) {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="flex flex-col gap-2">
          <SectionTag>Check Your Email</SectionTag>
          <h1 className="font-display font-semibold text-3xl text-pearl-text tracking-tight">
            Confirm your account
          </h1>
          <p className="font-sans text-sm text-muted-text leading-relaxed mt-2">
            We sent a confirmation link to your email address. Please click the link to finish setting up your account.
          </p>
        </div>
        <Button onClick={onSwitchToLogin} variant="outline" className="mt-4">
          Return to Sign In
        </Button>
      </div>
    );
  }

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
          disabled={!isValid || loading}
          loading={loading}
        >
          Create Account
        </Button>
        
        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-abyssal-border"></div>
          <span className="flex-shrink-0 mx-4 text-muted-text text-xs uppercase tracking-wider font-semibold">Or</span>
          <div className="flex-grow border-t border-abyssal-border"></div>
        </div>

        <Button
          type="button"
          size="lg"
          variant="outline"
          className="w-full relative"
          onClick={handleGoogleSignUp}
          disabled={loading}
        >
          <div className="absolute left-4">
            <GoogleIcon />
          </div>
          Sign up with Google
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
