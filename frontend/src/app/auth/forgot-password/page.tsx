'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Mail, ArrowRight, Lock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/toaster';
import { api } from '@/lib/api/client';
import { AppErrorBoundary } from '@/app/error-boundary';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type EmailFormData = z.infer<typeof emailSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { success, error: showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const resetForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onEmailSubmit = async (data: EmailFormData) => {
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setEmailSent(true);
      success('Email Sent', 'Please check your inbox for password reset instructions.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      showError('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const onResetSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      showError('Error', 'Invalid or missing reset token');
      return;
    }

    setIsResetting(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword: data.password,
      });
      success('Password Reset', 'Your password has been reset successfully. You can now login.');
      router.push('/auth/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      showError('Error', message);
    } finally {
      setIsResetting(false);
    }
  };

  // If token is present, show reset password form
  if (token) {
    return (
      <AppErrorBoundary>
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Lock className="h-6 w-6" />
                Reset Password
              </CardTitle>
              <CardDescription>
                Enter your new password below
              </CardDescription>
            </CardHeader>
            
            <form onSubmit={resetForm.handleSubmit(onResetSubmit)}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    {...resetForm.register('password')}
                    type="password"
                    label="New Password"
                    placeholder="Enter new password"
                    error={resetForm.formState.errors.password?.message}
                    autoComplete="new-password"
                    autoFocus
                    aria-describedby="password-requirements"
                  />
                  <div id="password-requirements" className="text-xs text-muted-foreground space-y-1">
                    <p>Password must contain:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>At least 8 characters</li>
                      <li>One uppercase letter</li>
                      <li>One lowercase letter</li>
                      <li>One number</li>
                      <li>One special character</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-2">
                  <Input
                    {...resetForm.register('confirmPassword')}
                    type="password"
                    label="Confirm Password"
                    placeholder="Confirm new password"
                    error={resetForm.formState.errors.confirmPassword?.message}
                    autoComplete="new-password"
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  isLoading={isResetting}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Reset Password
                </Button>

                <Link
                  href="/auth/login"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Back to Login
                </Link>
              </CardFooter>
            </form>
          </Card>
        </div>
      </AppErrorBoundary>
    );
  }

  // Show email input form
  return (
    <AppErrorBoundary>
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        {emailSent ? (
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1 text-center">
              <div className="mx-auto mb-4 p-3 bg-green-100 dark:bg-green-900/20 rounded-full w-fit">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
              <CardDescription>
                We&apos;ve sent password reset instructions to your email address.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center mb-4">
                If you don&apos;t see the email, check your spam folder or try again.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Link href="/auth/login">
                <Button variant="outline" className="w-full">
                  Back to Login
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ) : (
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Forgot Password
              </CardTitle>
              <CardDescription>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </CardDescription>
            </CardHeader>
            
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    {...emailForm.register('email')}
                    type="email"
                    label="Email"
                    placeholder="you@example.com"
                    error={emailForm.formState.errors.email?.message}
                    autoComplete="email"
                    autoFocus
                    aria-describedby="email-description"
                  />
                  <p id="email-description" className="text-xs text-muted-foreground">
                    We&apos;ll send password reset instructions to this email.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Send Reset Link
                </Button>

                <Link
                  href="/auth/login"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium text-center"
                >
                  Back to Login
                </Link>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </AppErrorBoundary>
  );
}
