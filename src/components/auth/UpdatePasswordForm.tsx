'use client';
// components/auth/UpdatePasswordForm.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { updatePasswordSchema, UpdatePasswordFormValues } from './schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError, SectionTag } from '@/components/ui/label';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordForm() {
  const router = useRouter();
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
  } = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    mode: 'onChange',
  });

  const onSubmit = async (values: UpdatePasswordFormValues) => {
    setLoading(true);
    setApiError('');
    setSuccess(false);
    
    const { error } = await supabase.auth.updateUser({
      password: values.password,
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
        <SectionTag>Security</SectionTag>
        <h1 className="font-display font-semibold text-3xl text-pearl-text tracking-tight">
          Update Password
        </h1>
        <p className="font-sans text-sm text-muted-text leading-relaxed max-w-sm">
          Please enter your new password below.
        </p>
      </div>

      {/* ── Form ───────────────────────────────── */}
      {success ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-3">
            <p className="font-sans text-sm text-emerald-500">
              Your password has been successfully updated.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => router.push('/dashboard')}
          >
            Go to Dashboard
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

          {/* New Password */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="update-password">New Password</Label>
            <Input
              id="update-password"
              type="password"
              placeholder="Your new password"
              autoComplete="new-password"
              icon={<Lock size={16} />}
              error={!!errors.password || !!apiError}
              {...register('password')}
            />
            <FieldError message={errors.password?.message} />
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="update-confirm-password">Confirm Password</Label>
            <Input
              id="update-confirm-password"
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
              icon={<Lock size={16} />}
              error={!!errors.confirmPassword || !!apiError}
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
            Update Password
          </Button>
        </form>
      )}
    </div>
  );
}
