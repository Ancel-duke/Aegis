'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSettingsStore } from '@/stores/settings-store';
import { useToast } from '@/components/ui/toaster';
import {
  Settings,
  Bell,
  Palette,
  AlertTriangle,
  Save,
  RefreshCw,
  Mail,
  Smartphone,
  Wifi,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlertSeverity } from '@/types';

const severityOptions: AlertSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

export default function SettingsPage() {
  const {
    settings,
    isLoading,
    isSaving,
    error,
    fetchSettings,
    updateNotifications,
    updateUI,
    updateAlerts,
    clearError,
  } = useSettingsStore();
  const { success, error: showError } = useToast();

  const [notifications, setNotifications] = useState(settings?.notifications);
  const [ui, setUI] = useState(settings?.ui);
  const [alerts, setAlerts] = useState(settings?.alerts);

  useEffect(() => {
    if (!settings) {
      fetchSettings();
    } else {
      setNotifications(settings.notifications);
      setUI(settings.ui);
      setAlerts(settings.alerts);
    }
  }, [settings, fetchSettings]);

  const handleSaveNotifications = async () => {
    try {
      if (notifications) {
        await updateNotifications(notifications);
        success('Settings Updated', 'Notification preferences saved successfully.');
      }
    } catch (err) {
      showError('Error', 'Failed to update notification settings.');
    }
  };

  const handleSaveUI = async () => {
    try {
      if (ui) {
        await updateUI(ui);
        success('Settings Updated', 'UI preferences saved successfully.');
      }
    } catch (err) {
      showError('Error', 'Failed to update UI settings.');
    }
  };

  const handleSaveAlerts = async () => {
    try {
      if (alerts) {
        await updateAlerts(alerts);
        success('Settings Updated', 'Alert preferences saved successfully.');
      }
    } catch (err) {
      showError('Error', 'Failed to update alert settings.');
    }
  };

  if (isLoading && !settings) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Settings
          </h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const currentNotifications = notifications || settings?.notifications;
  const currentUI = ui || settings?.ui;
  const currentAlerts = alerts || settings?.alerts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account and application preferences
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-md text-sm">
          {error}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearError}
            className="ml-2 h-auto p-0 text-red-700 dark:text-red-200"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure how and when you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium">Email Notifications</label>
                  <p className="text-xs text-muted-foreground">
                    Receive alerts via email
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentNotifications?.email ?? true}
                  onChange={(e) =>
                    setNotifications({
                      ...currentNotifications,
                      email: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium">Push Notifications</label>
                  <p className="text-xs text-muted-foreground">
                    Receive browser push notifications
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentNotifications?.push ?? true}
                  onChange={(e) =>
                    setNotifications({
                      ...currentNotifications,
                      push: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wifi className="h-5 w-5 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium">WebSocket Live Updates</label>
                  <p className="text-xs text-muted-foreground">
                    Real-time updates via WebSocket
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentNotifications?.websocket ?? true}
                  onChange={(e) =>
                    setNotifications({
                      ...currentNotifications,
                      websocket: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <label className="text-sm font-medium">Alert Severities</label>
            <p className="text-xs text-muted-foreground mb-2">
              Select which alert severities trigger notifications
            </p>
            <div className="flex flex-wrap gap-2">
              {severityOptions.map((severity) => (
                <Badge
                  key={severity}
                  variant={
                    currentNotifications?.alertSeverities?.includes(severity)
                      ? 'default'
                      : 'outline'
                  }
                  className="cursor-pointer capitalize"
                  onClick={() => {
                    const current = currentNotifications?.alertSeverities || [];
                    const updated = current.includes(severity)
                      ? current.filter((s) => s !== severity)
                      : [...current, severity];
                    setNotifications({
                      ...currentNotifications,
                      alertSeverities: updated,
                    });
                  }}
                >
                  {severity}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <label className="text-sm font-medium">Notification Frequency</label>
            <select
              value={currentNotifications?.alertFrequency || 'realtime'}
              onChange={(e) =>
                setNotifications({
                  ...currentNotifications,
                  alertFrequency: e.target.value as 'realtime' | 'hourly' | 'daily',
                })
              }
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="realtime">Real-time</option>
              <option value="hourly">Hourly digest</option>
              <option value="daily">Daily digest</option>
            </select>
          </div>

          <Button
            onClick={handleSaveNotifications}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Notification Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* UI Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            UI Preferences
          </CardTitle>
          <CardDescription>
            Customize the appearance and layout of the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Theme</label>
            <select
              value={currentUI?.theme || 'system'}
              onChange={(e) =>
                setUI({
                  ...currentUI,
                  theme: e.target.value as 'light' | 'dark' | 'system',
                })
              }
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Dashboard Layout</label>
            <select
              value={currentUI?.dashboardLayout || 'default'}
              onChange={(e) =>
                setUI({
                  ...currentUI,
                  dashboardLayout: e.target.value as 'default' | 'compact' | 'detailed',
                })
              }
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="default">Default</option>
              <option value="compact">Compact</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Items Per Page</label>
            <Input
              type="number"
              min="10"
              max="100"
              step="10"
              value={currentUI?.itemsPerPage || 20}
              onChange={(e) =>
                setUI({
                  ...currentUI,
                  itemsPerPage: parseInt(e.target.value, 10),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Number of items to display per page in lists
            </p>
          </div>

          <Button
            onClick={handleSaveUI}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save UI Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Alert Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alert Preferences
          </CardTitle>
          <CardDescription>
            Configure how alerts are displayed and handled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 pt-4">
            <label className="text-sm font-medium">Default Severity Filter</label>
            <p className="text-xs text-muted-foreground mb-2">
              Alerts to show by default when opening the Alerts page
            </p>
            <div className="flex flex-wrap gap-2">
              {severityOptions.map((severity) => (
                <Badge
                  key={severity}
                  variant={
                    currentAlerts?.defaultSeverityFilter?.includes(severity)
                      ? 'default'
                      : 'outline'
                  }
                  className="cursor-pointer capitalize"
                  onClick={() => {
                    const current = currentAlerts?.defaultSeverityFilter || [];
                    const updated = current.includes(severity)
                      ? current.filter((s) => s !== severity)
                      : [...current, severity];
                    setAlerts({
                      ...currentAlerts,
                      defaultSeverityFilter: updated,
                    });
                  }}
                >
                  {severity}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-3">
              <div>
                <label className="text-sm font-medium">Auto Acknowledge</label>
                <p className="text-xs text-muted-foreground">
                  Automatically acknowledge alerts when viewed
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={currentAlerts?.autoAcknowledge ?? false}
                onChange={(e) =>
                  setAlerts({
                    ...currentAlerts,
                    autoAcknowledge: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-3">
              {currentAlerts?.soundEnabled ? (
                <Volume2 className="h-5 w-5 text-muted-foreground" />
              ) : (
                <VolumeX className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <label className="text-sm font-medium">Sound Notifications</label>
                <p className="text-xs text-muted-foreground">
                  Play sound when new alerts arrive
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={currentAlerts?.soundEnabled ?? true}
                onChange={(e) =>
                  setAlerts({
                    ...currentAlerts,
                    soundEnabled: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <Button
            onClick={handleSaveAlerts}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Alert Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
