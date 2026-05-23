'use client';
// app/auth/page.tsx
// Manages view state: 'signup' | 'verify' | 'login'

import React from 'react';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/auth/AuthLayout';
import SignUpForm from '@/components/auth/SignUpForm';
import OtpForm   from '@/components/auth/OtpForm';
import LoginForm from '@/components/auth/LoginForm';

type AuthView = 'signup' | 'verify' | 'login';

export default function AuthPage() {
  const router = useRouter();
  const [view,  setView]  = React.useState<AuthView>('signup');
  const [email, setEmail] = React.useState('');

  const handleSignUpSuccess = (submittedEmail: string) => {
    setEmail(submittedEmail);
    setView('verify');
  };

  const handleVerifySuccess = () => {
    router.push('/onboarding');
  };

  const handleLoginSuccess = () => {
    router.push('/onboarding');
  };

  return (
    <AuthLayout>
      {view === 'signup' && (
        <SignUpForm
          onSuccess={handleSignUpSuccess}
          onSwitchToLogin={() => setView('login')}
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
          onSwitchToSignUp={() => setView('signup')}
        />
      )}
    </AuthLayout>
  );
}
