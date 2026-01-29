'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { usePoliciesStore } from '@/stores/policies-store';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/ui/toaster';
import { formatRelativeTime, cn } from '@/lib/utils';
import { Policy, PolicyType } from '@/types';
import {
  FileText,
  Plus,
  Search,
  Edit,
  Trash2,
  MoreVertical,
  Power,
  PowerOff,
  Shield,
  RefreshCw,
  Filter,
  X,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { JsonEditor } from '@/components/ui/json-editor';
import { Skeleton } from '@/components/ui/skeleton';

const policyTypeOptions: { label: string; value: PolicyType }[] = [
  { label: 'API Access', value: 'api_access' },
  { label: 'Self-Healing', value: 'self_healing' },
  { label: 'Data Access', value: 'data_access' },
  { label: 'Resource Limit', value: 'resource_limit' },
];

const policySchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  type: z.enum(['api_access', 'self_healing', 'data_access', 'resource_limit']),
  effect: z.enum(['allow', 'deny']),
  actions: z.array(z.string()).min(1, 'At least one action is required'),
  resources: z.array(z.string()).min(1, 'At least one resource is required'),
  conditions: z.string().refine(
    (val) => {
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid JSON format' }
  ),
  priority: z.number().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});

type PolicyFormData = z.infer<typeof policySchema>;

export default function PoliciesPage() {
  const {
    policies,
    evaluationLogs,
    isLoading,
    fetchPolicies,
    createPolicy,
    updatePolicy,
    deletePolicy,
    fetchEvaluationLogs,
  } = usePoliciesStore();
  
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [filters, setFilters] = useState<{ type?: PolicyType; enabled?: boolean }>({});

  const { hasRole } = useAuthStore();
  const { success, error: showError } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);

  const isAdmin = hasRole('admin');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      isActive: true,
      conditions: '{}',
      priority: 100,
      actions: [],
      resources: [],
    },
  });
  
  const actionsValue = watch('actions');
  const resourcesValue = watch('resources');

  useEffect(() => {
    fetchPolicies();
  }, []);

  // Filter policies by search and type
  const filteredPolicies = policies.filter((policy) => {
    if (filters.type && policy.type !== filters.type) return false;
    if (filters.enabled !== undefined && (policy.isActive !== undefined ? policy.isActive : true) !== filters.enabled) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      policy.name.toLowerCase().includes(query) ||
      (policy.description || '').toLowerCase().includes(query)
    );
  });

  const openCreateDialog = () => {
    setEditingPolicy(null);
    reset({
      name: '',
      description: '',
      type: 'api_access',
      effect: 'allow',
      actions: [] as string[],
      resources: [] as string[],
      conditions: '{}',
      priority: 100,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (policy: Policy) => {
    setEditingPolicy(policy);
    reset({
      name: policy.name,
      description: policy.description || '',
      type: policy.type,
      effect: policy.effect || 'allow',
      actions: policy.actions || [],
      resources: policy.resources || [],
      conditions: JSON.stringify(policy.conditions || {}, null, 2),
      priority: policy.priority || 100,
      isActive: policy.isActive !== undefined ? policy.isActive : true,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (policy: Policy) => {
    setSelectedPolicy(policy);
    setIsDeleteDialogOpen(true);
  };

  const onSubmit = async (data: PolicyFormData) => {
    try {
      const policyData = {
        name: data.name,
        description: data.description,
        type: data.type,
        effect: data.effect,
        actions: data.actions,
        resources: data.resources,
        conditions: JSON.parse(data.conditions),
        priority: data.priority || 100,
        isActive: data.isActive !== undefined ? data.isActive : true,
      };

      if (editingPolicy) {
        await updatePolicy(editingPolicy.id, policyData);
        success('Policy Updated', 'The policy has been updated successfully.');
      } else {
        await createPolicy(policyData);
        success('Policy Created', 'The policy has been created successfully.');
      }

      setIsDialogOpen(false);
      reset();
    } catch (err) {
      showError('Error', 'Failed to save policy.');
    }
  };

  const handleDelete = async () => {
    if (!selectedPolicy) return;

    try {
      await deletePolicy(selectedPolicy.id);
      success('Policy Deleted', 'The policy has been deleted.');
      setIsDeleteDialogOpen(false);
    } catch {
      showError('Error', 'Failed to delete policy.');
    }
  };

  const handleToggle = async (policy: Policy) => {
    try {
      await updatePolicy(policy.id, { enabled: !policy.enabled });
      success(
        policy.enabled ? 'Policy Disabled' : 'Policy Enabled',
        `The policy has been ${policy.enabled ? 'disabled' : 'enabled'}.`
      );
    } catch {
      showError('Error', 'Failed to toggle policy.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Policy Management
          </h1>
          <p className="text-muted-foreground">
            Configure access control and self-healing policies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchPolicies()}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          {isAdmin && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Policy
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 min-h-[44px]"
                aria-label="Search policies"
              />
            </div>

            {/* Type filter */}
            <select
              value={filters.type || ''}
              onChange={(e) =>
                setFilters({ type: e.target.value as PolicyType || undefined })
              }
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Types</option>
              {policyTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={filters.enabled === undefined ? '' : String(filters.enabled)}
              onChange={(e) =>
                setFilters({
                  enabled: e.target.value === '' ? undefined : e.target.value === 'true',
                })
              }
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>

            {(filters.type || filters.enabled !== undefined) && (
              <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Policies list */}
      <Card>
        <CardHeader>
          <CardTitle>Policies ({filteredPolicies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No policies found</p>
              <p className="text-sm">Create a policy to get started</p>
            </div>
          ) : (
            <>
              {/* Card layout for small screens (≤640px) */}
              <div className="space-y-3 sm:hidden" role="list">
                {filteredPolicies.map((policy) => (
                  <div
                    key={policy.id}
                    className="rounded-lg border p-4 space-y-2 bg-card"
                    role="listitem"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{policy.name}</p>
                      <Badge variant={policy.isActive !== false ? 'success' : 'secondary'}>
                        {policy.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {policy.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{policy.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline" className="capitalize">
                        {policy.type.replace('-', ' ')}
                      </Badge>
                      <span className="text-muted-foreground">
                        {policy.actions?.length || 0} action{policy.actions?.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground">{formatRelativeTime(policy.updatedAt)}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(policy)} className="min-h-[44px] flex-1">
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleToggle(policy)} className="min-h-[44px] flex-1">
                          {policy.isActive !== false ? <PowerOff className="h-4 w-4 mr-1" /> : <Power className="h-4 w-4 mr-1" />}
                          {policy.isActive !== false ? 'Disable' : 'Enable'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openDeleteDialog(policy)} className="min-h-[44px] text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Table layout for sm and up */}
              <div className="overflow-x-auto scrollbar-thin hidden sm:block" role="region" aria-label="Policies table">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rules</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Updated</th>
                      {isAdmin && (
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPolicies.map((policy) => (
                    <tr key={policy.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{policy.name}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {policy.description}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="capitalize">
                          {policy.type.replace('-', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-muted-foreground">
                          {policy.actions?.length || 0} action{policy.actions?.length !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={policy.isActive !== false ? 'success' : 'secondary'}>
                          {policy.isActive !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {formatRelativeTime(policy.updatedAt)}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                className="min-w-[160px] bg-popover rounded-md border shadow-md p-1"
                                align="end"
                              >
                                <DropdownMenu.Item
                                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent rounded-sm"
                                  onClick={() => openEditDialog(policy)}
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent rounded-sm"
                                  onClick={() => handleToggle(policy)}
                                >
                                  {(policy.isActive !== false) ? (
                                    <>
                                      <PowerOff className="h-4 w-4" />
                                      Disable
                                    </>
                                  ) : (
                                    <>
                                      <Power className="h-4 w-4" />
                                      Enable
                                    </>
                                  )}
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator className="h-px bg-border my-1" />
                                <DropdownMenu.Item
                                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent rounded-sm text-red-600"
                                  onClick={() => openDeleteDialog(policy)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </td>
                      )}
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto z-50">
            <Dialog.Title className="text-xl font-semibold mb-4">
              {editingPolicy ? 'Edit Policy' : 'Create Policy'}
            </Dialog.Title>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Input
                  {...register('name')}
                  label="Name"
                  placeholder="Policy name"
                  error={errors.name?.message}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <textarea
                  {...register('description')}
                  placeholder="Describe what this policy does"
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {errors.description && (
                  <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <select
                  {...register('type')}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {policyTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Effect</label>
                <select
                  {...register('effect')}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="allow">Allow</option>
                  <option value="deny">Deny</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Actions (comma-separated)</label>
                <Input
                  value={Array.isArray(actionsValue) ? actionsValue.join(', ') : ''}
                  onChange={(e) => {
                    const actions = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    setValue('actions', actions);
                  }}
                  placeholder="read, write, delete"
                />
                {errors.actions && (
                  <p className="text-sm text-red-500 mt-1">{errors.actions.message}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Resources (comma-separated)</label>
                <Input
                  value={Array.isArray(resourcesValue) ? resourcesValue.join(', ') : ''}
                  onChange={(e) => {
                    const resources = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    setValue('resources', resources);
                  }}
                  placeholder="/api/users, /api/policies"
                />
                {errors.resources && (
                  <p className="text-sm text-red-500 mt-1">{errors.resources.message}</p>
                )}
              </div>

              <div>
                <JsonEditor
                  value={watch('conditions') || '{}'}
                  onChange={(newValue) => {
                    setValue('conditions', newValue, { shouldValidate: true });
                  }}
                  error={errors.conditions?.message}
                  label="Conditions (JSON)"
                  height="300px"
                  readOnly={false}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Priority (0-1000)</label>
                <Input
                  {...register('priority', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  max="1000"
                  placeholder="100"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  id="isActive"
                  className="rounded border-gray-300"
                />
                <label htmlFor="isActive" className="text-sm">
                  Active
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isLoading}>
                  {editingPolicy ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>

            <Dialog.Close asChild>
              <button
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-lg shadow-lg p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-xl font-semibold mb-2">
              Delete Policy
            </Dialog.Title>
            <Dialog.Description className="text-muted-foreground mb-4">
              Are you sure you want to delete &quot;{selectedPolicy?.name}&quot;? This action cannot be undone.
            </Dialog.Description>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                isLoading={isLoading}
              >
                Delete
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
