'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/ui/toaster';

const signupSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .optional(),
  email: z.string().email('Invalid email address'),
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

type SignupFormData = z.infer<typeof signupSchema>;

const passwordRequirements = [
  { label: 'At least 8 characters', regex: /.{8,}/ },
  { label: 'One uppercase letter', regex: /[A-Z]/ },
  { label: 'One lowercase letter', regex: /[a-z]/ },
  { label: 'One number', regex: /[0-9]/ },
  { label: 'One special character', regex: /[^A-Za-z0-9]/ },
];

export default function SignupPage() {
  const router = useRouter();
  const { signup, isLoading, error, clearError } = useAuthStore();
  const { error: showError, success: showSuccess } = useToast();
  const [password, setPassword] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const watchPassword = watch('password', '');

  const onSubmit = async (data: SignupFormData) => {
    try {
      clearError();
      await signup(data.email, data.password, data.firstName, data.lastName);
      showSuccess('Account Created', 'Welcome to Aegis!');
      router.push('/dashboard');
    } catch (err) {
      const message =
        (err as { message?: string })?.message ??
        (err instanceof Error ? err.message : 'Signup failed');
      showError('Signup Failed', message);
    }
  };

  return (
    <>
      {/* Mobile logo */}
      <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
        <Shield className="h-8 w-8 text-primary-600" />
        <span className="text-xl font-bold">Aegis</span>
      </div>

      <Card className="border-0 shadow-none lg:border lg:shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>
            Get started with Aegis platform
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Input
                {...register('firstName')}
                type="text"
                label="First Name"
                placeholder="John"
                error={errors.firstName?.message}
                autoComplete="given-name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Input
                {...register('lastName')}
                type="text"
                label="Last Name (Optional)"
                placeholder="Doe"
                error={errors.lastName?.message}
                autoComplete="family-name"
              />
            </div>

            <div className="space-y-2">
              <Input
                {...register('email')}
                type="email"
                label="Email"
                placeholder="you@example.com"
                error={errors.email?.message}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Input
                {...register('password')}
                type="password"
                label="Password"
                placeholder="Create a strong password"
                error={errors.password?.message}
                autoComplete="new-password"
              />
              
              {/* Password requirements */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {passwordRequirements.map((req) => (
                  <div
                    key={req.label}
                    className={`flex items-center gap-1.5 text-xs ${
                      req.regex.test(watchPassword)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Check className={`h-3 w-3 ${
                      req.regex.test(watchPassword) ? 'opacity-100' : 'opacity-0'
                    }`} />
                    {req.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Input
                {...register('confirmPassword')}
                type="password"
                label="Confirm Password"
                placeholder="Confirm your password"
                error={errors.confirmPassword?.message}
                autoComplete="new-password"
              />
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                required
                className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-muted-foreground">
                I agree to the{' '}
                <Link href="/terms" className="text-primary-600 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-primary-600 hover:underline">
                  Privacy Policy
                </Link>
              </span>
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
              Create Account
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{' '}
              <Link
                href="/auth/login"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
