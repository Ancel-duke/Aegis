import { create } from 'zustand';
import { Policy } from '@/types';
import { api } from '@/lib/api/client';

type EvaluationLogEntry = {
  id: string;
  userId: string;
  action: string;
  resource: string;
  result: 'allow' | 'deny';
  timestamp: string;
};

interface PoliciesState {
  policies: Policy[];
  evaluationLogs: EvaluationLogEntry[];
  isLoading: boolean;
  error: string | null;
}

interface PoliciesActions {
  fetchPolicies: () => Promise<void>;
  createPolicy: (policy: Omit<Policy, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void>;
  updatePolicy: (id: string, updates: Partial<Policy>) => Promise<void>;
  deletePolicy: (id: string) => Promise<void>;
  fetchEvaluationLogs: (filters?: { userId?: string; action?: string }) => Promise<void>;
  clearError: () => void;
}

type PoliciesStore = PoliciesState & PoliciesActions;

export const usePoliciesStore = create<PoliciesStore>((set) => ({
  policies: [],
  evaluationLogs: [],
  isLoading: false,
  error: null,

  fetchPolicies: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Policy[]>('/policy');
      set({ policies: response, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch policies',
        isLoading: false,
      });
    }
  },

  createPolicy: async (policyData) => {
    try {
      const newPolicy = await api.post<Policy>('/policy', policyData);
      set((state) => ({ policies: [...state.policies, newPolicy] }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create policy',
      });
      throw error;
    }
  },

  updatePolicy: async (id, updates) => {
    try {
      const updated = await api.patch<Policy>(`/policy/${id}`, updates);
      set((state) => ({
        policies: state.policies.map((p) => (p.id === id ? updated : p)),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update policy',
      });
      throw error;
    }
  },

  deletePolicy: async (id) => {
    try {
      await api.delete(`/policy/${id}`);
      set((state) => ({
        policies: state.policies.filter((p) => p.id !== id),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete policy',
      });
      throw error;
    }
  },

  fetchEvaluationLogs: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<EvaluationLogEntry[]>('/policy/audit/logs', filters);
      set({ evaluationLogs: response ?? [], isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch evaluation logs',
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
