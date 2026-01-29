import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserSettings, NotificationPreferences, UIPreferences, AlertPreferences, ApiError } from '@/types';
import { api } from '@/lib/api/client';

interface SettingsState {
  settings: UserSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

interface SettingsActions {
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  updateNotifications: (notifications: Partial<NotificationPreferences>) => Promise<void>;
  updateUI: (ui: Partial<UIPreferences>) => Promise<void>;
  updateAlerts: (alerts: Partial<AlertPreferences>) => Promise<void>;
  clearError: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

const defaultSettings: UserSettings = {
  notifications: {
    email: true,
    push: true,
    websocket: true,
    alertSeverities: ['critical', 'high'],
    alertFrequency: 'realtime',
  },
  ui: {
    theme: 'system',
    dashboardLayout: 'default',
    itemsPerPage: 20,
  },
  alerts: {
    defaultSeverityFilter: [],
    autoAcknowledge: false,
    soundEnabled: true,
  },
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: null,
      isLoading: false,
      isSaving: false,
      error: null,

      fetchSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          const settings = await api.get<UserSettings>('/settings');
          set({ settings, isLoading: false, error: null });
        } catch (error) {
          const message =
            (error as ApiError)?.message ??
            (error instanceof Error ? error.message : 'Failed to fetch settings');
          set({ settings: defaultSettings, isLoading: false, error: message });
        }
      },

      updateSettings: async (updates: Partial<UserSettings>) => {
        set({ isSaving: true, error: null });
        try {
          const updatedSettings = await api.patch<UserSettings>('/settings', updates);
          set({ settings: updatedSettings, isSaving: false, error: null });
        } catch (error) {
          const message =
            (error as ApiError)?.message ??
            (error instanceof Error ? error.message : 'Failed to update settings');
          set({ isSaving: false, error: message });
          throw error;
        }
      },

      updateNotifications: async (notifications: Partial<NotificationPreferences>) => {
        const { settings } = get();
        if (!settings) {
          await get().fetchSettings();
        }
        await get().updateSettings({
          notifications: {
            ...(get().settings?.notifications || defaultSettings.notifications),
            ...notifications,
          },
        });
      },

      updateUI: async (ui: Partial<UIPreferences>) => {
        const { settings } = get();
        if (!settings) {
          await get().fetchSettings();
        }
        await get().updateSettings({
          ui: {
            ...(get().settings?.ui || defaultSettings.ui),
            ...ui,
          },
        });
      },

      updateAlerts: async (alerts: Partial<AlertPreferences>) => {
        const { settings } = get();
        if (!settings) {
          await get().fetchSettings();
        }
        await get().updateSettings({
          alerts: {
            ...(get().settings?.alerts || defaultSettings.alerts),
            ...alerts,
          },
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'aegis-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);
