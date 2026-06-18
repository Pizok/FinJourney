'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLayout from '@/components/auth/AuthLayout';
import SignUpForm from '@/components/auth/SignUpForm';
import OtpForm   from '@/components/auth/OtpForm';
import LoginForm from '@/components/auth/LoginForm';

type AuthView = 'signup' | 'verify' | 'login';

// 1. We move the main logic into a sub-component
function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 2. Read the URL parameter and use it as the default state
  const urlView = searchParams.get('view') as AuthView;
  const [view, setView] = React.useState<AuthView>(urlView || 'signup');
  const [email, setEmail] = React.useState('');

  // 3. Keep the state synced if the URL changes (like hitting the back button)
  useEffect(() => {
    if (urlView === 'login' || urlView === 'signup' || urlView === 'verify') {
      setView(urlView);
    }
  }, [urlView]);

  const handleSignUpSuccess = (submittedEmail: string) => {
    setEmail(submittedEmail);
    setView('verify');
  };

  const handleVerifySuccess = () => {
    router.push('/dashboard');
  };

  const handleLoginSuccess = () => {
    router.push('/dashboard');
  };

  // 4. Update the switch buttons to actually change the URL, not just the state
  return (
    <AuthLayout>
      {view === 'signup' && (
        <SignUpForm
          onSuccess={handleSignUpSuccess}
          onSwitchToLogin={() => router.push('?view=login')}
        />
      )}
      {view === 'verify' && (
        <OtpForm
          email={email}
          onSuccess={handleVerifySuccess}
        />
      )}
      {view === 'login' && (
        <LoginForm
          onSuccess={handleLoginSuccess}
          onSwitchToSignUp={() => router.push('?view=signup')}
        />
      )}
    </AuthLayout>
  );
}

// 5. Wrap the page in Suspense to prevent Next.js build errors
export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-abyssal-slate" />}>
      <AuthContent />
    </Suspense>
  );
}