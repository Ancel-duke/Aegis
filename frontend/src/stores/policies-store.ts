import { create } from 'zustand';
import { Policy, PolicyType, PaginatedResponse } from '@/types';
import { api } from '@/lib/api/client';

interface PoliciesState {
  policies: Policy[];
  selectedPolicy: Policy | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    type?: PolicyType;
    enabled?: boolean;
    search?: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface PoliciesActions {
  fetchPolicies: (page?: number, limit?: number) => Promise<void>;
  fetchPolicy: (id: string) => Promise<void>;
  createPolicy: (policy: Omit<Policy, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<Policy>;
  updatePolicy: (id: string, policy: Partial<Policy>) => Promise<Policy>;
  deletePolicy: (id: string) => Promise<void>;
  togglePolicy: (id: string) => Promise<void>;
  setFilters: (filters: Partial<PoliciesState['filters']>) => void;
  clearFilters: () => void;
  selectPolicy: (policy: Policy | null) => void;
  clearError: () => void;
}

type PoliciesStore = PoliciesState & PoliciesActions;

const initialState: PoliciesState = {
  policies: [],
  selectedPolicy: null,
  isLoading: false,
  error: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
};

export const usePoliciesStore = create<PoliciesStore>((set, get) => ({
  ...initialState,

  fetchPolicies: async (page = 1, limit = 20) => {
    set({ isLoading: true, error: null });

    try {
      const { filters } = get();
      const response = await api.get<PaginatedResponse<Policy>>('/policies', {
        page,
        limit,
        ...filters,
      });

      set({
        policies: response.items,
        isLoading: false,
        pagination: {
          page: response.page,
          limit: response.limit,
          total: response.total,
          totalPages: response.totalPages,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch policies';
      set({ error: message, isLoading: false });
    }
  },

  fetchPolicy: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const policy = await api.get<Policy>(`/policies/${id}`);
      set({ selectedPolicy: policy, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch policy';
      set({ error: message, isLoading: false });
    }
  },

  createPolicy: async (policyData) => {
    set({ isLoading: true, error: null });

    try {
      const policy = await api.post<Policy>('/policies', policyData);
      const { policies } = get();

      set({
        policies: [policy, ...policies],
        isLoading: false,
      });

      return policy;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create policy';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updatePolicy: async (id: string, policyData: Partial<Policy>) => {
    set({ isLoading: true, error: null });

    try {
      const policy = await api.patch<Policy>(`/policies/${id}`, policyData);
      const { policies, selectedPolicy } = get();

      set({
        policies: policies.map((p) => (p.id === id ? policy : p)),
        selectedPolicy: selectedPolicy?.id === id ? policy : selectedPolicy,
        isLoading: false,
      });

      return policy;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update policy';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deletePolicy: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      await api.delete(`/policies/${id}`);
      const { policies, selectedPolicy } = get();

      set({
        policies: policies.filter((p) => p.id !== id),
        selectedPolicy: selectedPolicy?.id === id ? null : selectedPolicy,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete policy';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  togglePolicy: async (id: string) => {
    const { policies } = get();
    const policy = policies.find((p) => p.id === id);
    
    if (!policy) return;

    try {
      await get().updatePolicy(id, { enabled: !policy.enabled });
    } catch (error) {
      throw error;
    }
  },

  setFilters: (newFilters) => {
    const { filters } = get();
    set({ filters: { ...filters, ...newFilters } });
  },

  clearFilters: () => {
    set({ filters: {} });
  },

  selectPolicy: (policy: Policy | null) => {
    set({ selectedPolicy: policy });
  },

  clearError: () => set({ error: null }),
}));
