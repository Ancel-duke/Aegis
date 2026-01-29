'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/ui/toaster';
import { api } from '@/lib/api/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  Mail,
  Shield,
  Key,
  Save,
  Clock,
  Activity,
} from 'lucide-react';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().max(50).optional(),
  avatar: z.string().url().optional().or(z.literal('')),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const { success, error: showError } = useToast();
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      avatar: user?.avatar || '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsProfileLoading(true);
    try {
      if (!user?.id) throw new Error('User not found');
      await api.patch(`/users/${user.id}`, data);
      await refreshUser();
      success('Profile Updated', 'Your profile has been updated successfully.');
    } catch (err) {
      showError('Error', 'Failed to update profile.');
    } finally {
      setIsProfileLoading(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setIsPasswordLoading(true);
    try {
      if (!user?.id) throw new Error('User not found');
      await api.patch(`/users/${user.id}/password`, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      passwordForm.reset();
      success('Password Changed', 'Your password has been changed successfully.');
    } catch (err) {
      showError('Error', 'Failed to change password. Please check your current password.');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const getRoleBadge = () => {
    switch (user?.role) {
      case 'admin':
        return <Badge variant="destructive">Admin</Badge>;
      case 'auditor':
        return <Badge variant="warning">Auditor</Badge>;
      default:
        return <Badge variant="secondary">User</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <User className="h-8 w-8" />
          Profile
        </h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Account Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div className="h-20 w-20 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-primary-700 dark:text-primary-300">
                  {(user?.firstName || user?.email || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">
                  {user?.firstName || user?.email?.split('@')[0] || 'User'}
                  {user?.lastName && ` ${user.lastName}`}
                </h2>
                {getRoleBadge()}
              </div>
              <p className="text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {user?.email}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Profile
          </CardTitle>
          <CardDescription>
            Update your profile information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                {...profileForm.register('firstName')}
                label="First Name"
                placeholder="John"
                error={profileForm.formState.errors.firstName?.message}
              />
              <Input
                {...profileForm.register('lastName')}
                label="Last Name"
                placeholder="Doe"
                error={profileForm.formState.errors.lastName?.message}
              />
            </div>
            <Input
              {...profileForm.register('avatar')}
              label="Avatar URL (Optional)"
              placeholder="https://example.com/avatar.jpg"
              error={profileForm.formState.errors.avatar?.message}
            />

            <Button type="submit" isLoading={isProfileLoading}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <Input
              {...passwordForm.register('currentPassword')}
              type="password"
              label="Current Password"
              placeholder="Enter your current password"
              error={passwordForm.formState.errors.currentPassword?.message}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                {...passwordForm.register('newPassword')}
                type="password"
                label="New Password"
                placeholder="Enter new password"
                error={passwordForm.formState.errors.newPassword?.message}
              />
              <Input
                {...passwordForm.register('confirmPassword')}
                type="password"
                label="Confirm Password"
                placeholder="Confirm new password"
                error={passwordForm.formState.errors.confirmPassword?.message}
              />
            </div>

            <Button type="submit" isLoading={isPasswordLoading}>
              <Key className="h-4 w-4 mr-2" />
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Role & Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role & Permissions
          </CardTitle>
          <CardDescription>
            Your current role and access permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Current Role</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {user?.role}
                </p>
              </div>
              {getRoleBadge()}
            </div>

            <div>
              <p className="font-medium mb-3">Permissions</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {user?.role === 'admin' && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      View Dashboard
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      Manage Alerts
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      Manage Policies
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      View AI Insights
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      View Logs
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      Manage Users
                    </div>
                  </>
                )}
                {user?.role === 'auditor' && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      View Dashboard
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      View Alerts
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      View Policies
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      View AI Insights
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      View Logs
                    </div>
                  </>
                )}
                {user?.role === 'user' && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      View Dashboard
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      View Alerts
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
