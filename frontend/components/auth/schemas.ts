// components/auth/schemas.ts
// Zod validation schemas — kept separate from JSX for clarity.

import { z } from 'zod';

export const signUpSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Please enter a valid email address.')
      .email('Please enter a valid email address.'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const otpSchema = z.object({
  code: z
    .string()
    .length(6, 'Please enter the 6-digit code.')
    .regex(/^\d+$/, 'Code must be numeric.'),
});

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Please enter a valid email address.')
    .email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Please enter a valid email address.')
    .email('Please enter a valid email address.'),
});

export const updatePasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string().min(1, 'Please confirm your password.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});


export type SignUpFormValues = z.infer<typeof signUpSchema>;
export type OtpFormValues   = z.infer<typeof otpSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;
