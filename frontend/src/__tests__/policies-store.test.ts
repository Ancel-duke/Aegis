import { renderHook, act } from '@testing-library/react';
import { usePoliciesStore } from '@/stores/policies-store';
import { api } from '@/lib/api/client';
import { Policy } from '@/types';

jest.mock('@/lib/api/client');

describe('PoliciesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePoliciesStore.setState({
      policies: [],
      evaluationLogs: [],
      isLoading: false,
      error: null,
    });
  });

  describe('fetchPolicies', () => {
    it('should fetch and store policies', async () => {
      const mockPolicies: Policy[] = [
        {
          id: '1',
          name: 'Test Policy',
          description: 'Test description',
          type: 'api_access',
          effect: 'allow',
          actions: ['read'],
          resources: ['/api/users'],
          conditions: {},
          priority: 100,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      (api.get as jest.Mock).mockResolvedValueOnce(mockPolicies);

      const { result } = renderHook(() => usePoliciesStore());

      await act(async () => {
        await result.current.fetchPolicies();
      });

      expect(result.current.policies).toHaveLength(1);
      expect(result.current.policies[0].name).toBe('Test Policy');
    });

    it('should handle API errors', async () => {
      (api.get as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() => usePoliciesStore());

      await act(async () => {
        await result.current.fetchPolicies();
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('createPolicy', () => {
    it('should create and add policy', async () => {
      const newPolicy: Policy = {
        id: '2',
        name: 'New Policy',
        type: 'api_access',
        effect: 'allow',
        actions: ['write'],
        resources: ['/api/policies'],
        conditions: {},
        priority: 100,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (api.post as jest.Mock).mockResolvedValueOnce(newPolicy);

      const { result } = renderHook(() => usePoliciesStore());

      await act(async () => {
        await result.current.createPolicy({
          name: 'New Policy',
          type: 'api_access',
          effect: 'allow',
          actions: ['write'],
          resources: ['/api/policies'],
          conditions: {},
          priority: 100,
          isActive: true,
        });
      });

      expect(result.current.policies).toHaveLength(1);
      expect(result.current.policies[0].name).toBe('New Policy');
    });
  });

  describe('updatePolicy', () => {
    it('should update existing policy', async () => {
      const existingPolicy: Policy = {
        id: '1',
        name: 'Old Name',
        type: 'api_access',
        effect: 'allow',
        actions: ['read'],
        resources: ['/api/users'],
        conditions: {},
        priority: 100,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      usePoliciesStore.setState({ policies: [existingPolicy] });

      const updatedPolicy = { ...existingPolicy, name: 'New Name' };
      (api.patch as jest.Mock).mockResolvedValueOnce(updatedPolicy);

      const { result } = renderHook(() => usePoliciesStore());

      await act(async () => {
        await result.current.updatePolicy('1', { name: 'New Name' });
      });

      expect(result.current.policies[0].name).toBe('New Name');
    });
  });

  describe('deletePolicy', () => {
    it('should delete policy', async () => {
      const policy: Policy = {
        id: '1',
        name: 'To Delete',
        type: 'api_access',
        effect: 'allow',
        actions: ['read'],
        resources: ['/api/users'],
        conditions: {},
        priority: 100,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      usePoliciesStore.setState({ policies: [policy] });
      (api.delete as jest.Mock).mockResolvedValueOnce({});

      const { result } = renderHook(() => usePoliciesStore());

      await act(async () => {
        await result.current.deletePolicy('1');
      });

      expect(result.current.policies).toHaveLength(0);
    });
  });

  describe('fetchEvaluationLogs', () => {
    it('should fetch evaluation logs', async () => {
      const mockLogs = [
        {
          id: '1',
          userId: 'user-1',
          action: 'read',
          resource: '/api/users',
          result: 'allow' as const,
          timestamp: new Date().toISOString(),
        },
      ];

      (api.get as jest.Mock).mockResolvedValueOnce(mockLogs);

      const { result } = renderHook(() => usePoliciesStore());

      await act(async () => {
        await result.current.fetchEvaluationLogs();
      });

      expect(result.current.evaluationLogs).toHaveLength(1);
    });
  });
});
