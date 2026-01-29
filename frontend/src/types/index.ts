// User types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string; // Computed from firstName or email
  avatar?: string;
  role: UserRole;
  roles?: Array<{ name: string }>;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'auditor' | 'user';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Alert types
export interface Alert {
  id: string;
  title: string;
  description?: string;
  message?: string; // Alias for description
  severity: AlertSeverity;
  status: 'open' | 'acknowledged' | 'resolved';
  source?: string;
  timestamp: string;
  createdAt?: string;
  resolved: boolean; // Computed from status
  resolvedAt?: string;
  resolvedBy?: string;
  metadata?: Record<string, unknown>;
}

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AlertFilters {
  severity?: AlertSeverity[];
  resolved?: boolean;
  source?: string;
  startDate?: string;
  endDate?: string;
}

// Policy types
export interface Policy {
  id: string;
  name: string;
  description?: string;
  type: PolicyType;
  effect: 'allow' | 'deny';
  actions: string[];
  resources: string[];
  conditions: Record<string, unknown>;
  priority: number;
  isActive: boolean;
  enabled?: boolean; // Alias for isActive
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export type PolicyType = 'api_access' | 'self_healing' | 'data_access' | 'resource_limit';

// Metrics types
export interface SystemMetrics {
  cpu: MetricValue;
  memory: MetricValue;
  disk: MetricValue;
  network: NetworkMetrics;
  pods: PodMetrics;
}

export interface MetricValue {
  current: number;
  average: number;
  max: number;
  min: number;
  unit: string;
}

export interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
}

export interface PodMetrics {
  total: number;
  running: number;
  pending: number;
  failed: number;
}

// AI types
export interface AnomalyPrediction {
  id: string;
  timestamp: string;
  metric: string;
  value: number;
  predicted: number;
  anomalyScore: number;
  isAnomaly: boolean;
  severity: AlertSeverity;
  recommendation?: string;
}

export interface AIInsight {
  id: string;
  type: 'anomaly' | 'trend' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  severity: AlertSeverity;
  timestamp: string;
  data?: Record<string, unknown>;
}

// Self-healing types
export interface HealingAction {
  id: string;
  type: HealingActionType;
  target: string;
  status: HealingActionStatus;
  triggeredBy: string;
  triggeredAt: string;
  completedAt?: string;
  result?: string;
  metadata?: Record<string, unknown>;
}

export type HealingActionType = 
  | 'restart_pod'
  | 'scale_up'
  | 'scale_down'
  | 'rollback'
  | 'rate_limit';

export type HealingActionStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Log types
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogFilters {
  level?: LogLevel[];
  service?: string[];
  startDate?: string;
  endDate?: string;
  search?: string;
}

// Chart types
export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface TimeSeriesData {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

// API types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
