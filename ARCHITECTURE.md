# Aegis Platform Architecture

Complete microservices architecture for intelligent, policy-driven self-healing infrastructure.

## System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                         Aegis Platform                              │
│                                                                      │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐     │
│  │   Backend    │      │  AI Engine   │      │   Executor   │     │
│  │   (NestJS)   │◄────►│   (Python)   │◄────►│   (NestJS)   │     │
│  │              │      │              │      │              │     │
│  │ • Auth       │      │ • Anomaly    │      │ • K8s Ops    │     │
│  │ • Users      │      │   Detection  │      │ • Audit Log  │     │
│  │ • Policy     │      │ • Failure    │      │ • Safe Exec  │     │
│  │   Engine     │      │   Prediction │      │              │     │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘     │
│         │                     │                     │              │
│         │ metrics/logs/traces │                     │              │
│         └─────────────────────┴─────────────────────┘              │
│                               │                                     │
│                               ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Observability Layer                             │  │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │Prometheus  │  │   Loki   │  │  Tempo   │  │ Grafana  │ │  │
│  │  │  Metrics   │  │   Logs   │  │  Traces  │  │Dashboard │ │  │
│  │  └────────────┘  └──────────┘  └──────────┘  └──────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│  ┌────────────────────────────▼──────────────────────────────┐    │
│  │                    Data Layer                              │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │    │
│  │  │PostgreSQL│  │PostgreSQL│  │PostgreSQL│  │  Redis  │  │    │
│  │  │ Backend  │  │AI Engine │  │ Executor │  │  Cache  │  │    │
│  │  │   DB     │  │    DB    │  │   DB     │  │         │  │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │            External Integrations                              │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────────┐ │  │
│  │  │   Kubernetes API     │  │  OpenTelemetry Collector    │ │  │
│  │  │   (Cluster Ops)      │  │  (Telemetry Aggregation)     │ │  │
│  │  └──────────────────────┘  └──────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

## Services

### 1. Backend (NestJS) - Port 3000

**Purpose**: Core API, authentication, and policy evaluation

**Key Features**:
- JWT authentication with refresh tokens
- User management with RBAC
- Policy Engine for access control and self-healing decisions
- Rate limiting per user/endpoint
- Request logging and error handling
- Redis caching

**Modules**:
- `auth/` - JWT authentication
- `user/` - User management
- `policy/` - Policy evaluation engine
- `core/` - Health checks
- `common/` - Shared utilities

**Database**: PostgreSQL (users, policies, roles, audit logs)

**API Endpoints**:
```
POST   /api/v1/auth/signup
POST   /api/v1/auth/login
POST   /api/v1/policy/evaluate
GET    /api/v1/policy/audit/logs
GET    /api/v1/health
```

### 2. AI Engine (Python/FastAPI) - Port 8000

**Purpose**: ML-powered anomaly and failure detection

**Key Features**:
- Anomaly detection with Isolation Forest
- Failure pattern detection with Random Forest
- Feature engineering from metrics and logs
- Severity scoring and action recommendations
- Historical prediction storage
- Model performance tracking

**Models**:
- `AnomalyDetector` - Detects unusual metric patterns
- `FailureDetector` - Identifies failure patterns
- `DataPreprocessor` - Feature engineering pipeline

**Database**: PostgreSQL (predictions, model metrics, training data)

**API Endpoints**:
```
POST   /api/v1/detect-anomaly
POST   /api/v1/detect-failure
GET    /api/v1/metrics/predictions
GET    /health
```

### 3. Executor (NestJS) - Port 4000

**Purpose**: Safe Kubernetes action execution with audit logging

**Key Features**:
- Kubernetes operations (restart, scale, rollback)
- Action signature validation (HMAC-SHA256)
- Namespace restrictions
- Immutable audit logging to PostgreSQL and Loki
- Rate limiting on critical actions
- Policy integration

**Actions**:
- Restart pods
- Scale deployments
- Rollback deployments

**Database**: PostgreSQL (action audit logs)

**API Endpoints**:
```
POST   /executor/execute
POST   /executor/generate-signature
GET    /audit/logs
GET    /health
```

## Integration Flow

### Self-Healing Workflow

```
1. Prometheus/Loki
   │ Collect metrics and logs
   ▼
2. AI Engine
   │ Analyze for anomalies/failures
   │ Recommend action: "scale_up"
   │ Severity: "high"
   ▼
3. Policy Engine (Backend)
   │ Evaluate: Can AI Engine scale in production?
   │ Check: Role, time, metadata conditions
   │ Decision: ALLOW/DENY
   ▼
4. Executor
   │ IF allowed:
   │   - Validate signature
   │   - Check namespace whitelist
   │   - Execute K8s action
   │   - Log to audit trail
   │ ELSE:
   │   - Log denial
   │   - Alert administrator
   ▼
5. Kubernetes API
   │ Apply changes to cluster
   ▼
6. Audit Trail
   │ Immutable logs in PostgreSQL + Loki
```

### API Access Control Workflow

```
1. User Request
   │ POST /api/v1/users/456
   │ Token: user-jwt-token
   ▼
2. Backend - JWT Validation
   │ Verify token
   │ Extract user ID and roles
   ▼
3. Policy Engine
   │ Evaluate: Can this user delete user 456?
   │ Check: Role = "user", Action = "delete"
   │ Match: "Deny User Delete Operations"
   │ Decision: DENY
   ▼
4. Response
   │ 403 Forbidden
   │ Log to audit trail
```

## Data Flow

### Metrics Collection

```
Prometheus → AI Engine → Detection Results → Policy Engine → Executor → K8s
    │                                             │
    └─────────────────────────────────────────────┴─→ Audit Logs
```

### Log Analysis

```
Loki → AI Engine (analyze errors) → Failure Detection
  │                                       │
  │                                       ▼
  │                              Recommended Actions
  │                                       │
  │                                       ▼
  └───────────────────────────────→ Audit Logs
```

## Security Architecture

### Authentication & Authorization

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ 1. Login (email/password)
       ▼
┌─────────────┐
│  Backend    │
│  Auth API   │──► Hash password (bcrypt)
└──────┬──────┘    Verify in PostgreSQL
       │
       │ 2. Issue JWT tokens
       ▼
┌─────────────┐
│ Access      │ ← Short-lived (15 min)
│ Token       │
└─────────────┘

┌─────────────┐
│ Refresh     │ ← Long-lived (7 days)
│ Token       │
└─────────────┘
       │
       │ 3. Attach to requests
       ▼
┌─────────────┐
│  Protected  │──► Validate JWT
│  Endpoint   │    Extract user context
└──────┬──────┘    Check with Policy Engine
       │
       │ 4. Policy evaluation
       ▼
┌─────────────┐
│   Policy    │──► Match conditions
│   Engine    │    Apply priority rules
└──────┬──────┘    DENY overrides ALLOW
       │
       │ 5. Action approval/denial
       ▼
```

### Service-to-Service Security

```
AI Engine ──HMAC Signature──► Executor
    │                            │
    │  Payload + Secret          │ Verify signature
    │  = HMAC-SHA256             │ Check namespace
    │                            │ Validate request
    │                            ▼
    └──────────────────► Kubernetes API
                         (Service Account)
```

### Kubernetes RBAC

```
Executor Service Account
  │
  ├─► Role (default namespace)
  │   ├─ pods: get, list, delete
  │   └─ deployments: get, list, patch, update
  │
  ├─► Role (production namespace)
  │   ├─ pods: get, list, delete
  │   └─ deployments: get, list, patch, update
  │
  └─► RoleBindings (namespace-specific)
```

## Database Schema

### Backend Database

**Tables**:
- `users` - User accounts
- `roles` - RBAC roles (admin, user, auditor)
- `user_roles` - Many-to-many relationship
- `policies` - Policy definitions
- `policy_audit_logs` - Policy evaluation logs

### AI Engine Database

**Tables**:
- `prediction_history` - ML predictions
- `model_metrics` - Model performance
- `training_data` - Historical training data

### Executor Database

**Tables**:
- `action_audit_logs` - Immutable action execution logs

## Port Allocation

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Backend | 3000 | HTTP | Main API, Auth, Policy Engine |
| Executor | 4000 | HTTP | Action execution |
| AI Engine | 8000 | HTTP | ML inference |
| PostgreSQL (Backend) | 5432 | TCP | User/Policy data |
| PostgreSQL (AI) | 5433 | TCP | ML data |
| PostgreSQL (Executor) | 5434 | TCP | Audit logs |
| Redis | 6379 | TCP | Caching |

## Configuration

### Environment Variables

**Backend** (`.env`):
```env
JWT_SECRET=change_this_in_production
DB_HOST=localhost
REDIS_HOST=localhost
```

**AI Engine** (`.env`):
```env
PROMETHEUS_URL=http://localhost:9090
LOKI_URL=http://localhost:3100
POLICY_ENGINE_URL=http://localhost:3000/api/v1/policy/evaluate
ANOMALY_THRESHOLD=0.85
```

**Executor** (`.env`):
```env
KUBECONFIG_PATH=/path/to/kubeconfig
ALLOWED_NAMESPACES=default,production
REQUIRE_ACTION_SIGNATURE=true
POLICY_ENGINE_URL=http://localhost:3000/api/v1/policy/evaluate
```

## Deployment

### Docker Compose (Development)

```bash
# Start Backend
cd backend
docker-compose up -d

# Start AI Engine
cd ai-engine
docker-compose up -d

# Start Executor
cd executor
docker-compose up -d
```

### Kubernetes (Production)

```bash
# Deploy Backend
kubectl apply -f backend/k8s/

# Deploy AI Engine
kubectl apply -f ai-engine/k8s/

# Deploy Executor (with RBAC)
kubectl apply -f executor/k8s/service-account.yaml
kubectl apply -f executor/k8s/deployment.yaml
```

## Example Scenarios

### Scenario 1: High CPU Usage

```
1. Prometheus detects CPU > 85%
2. AI Engine receives metrics
   └─► detect-anomaly API
   └─► Result: "scale_up", severity "high"
3. AI Engine queries Policy Engine
   └─► "Can I scale_up in production?"
   └─► Policy: "Allow Auto-Scale" → ALLOW
4. AI Engine calls Executor
   └─► Execute: scale_deployment to 10 replicas
   └─► Signature validation
   └─► Namespace check: production ✓
5. Executor calls Kubernetes API
   └─► Scale deployment
6. Audit logs created
   └─► PostgreSQL (queryable)
   └─► Loki (centralized)
```

### Scenario 2: Pod Crash Loop

```
1. Loki detects repeated errors
2. AI Engine analyzes logs
   └─► detect-failure API
   └─► Result: "restart_pod", failure_type "service_down"
3. Policy check
   └─► "Can I restart_pod during business hours?"
   └─► Policy evaluation with time conditions
4. If allowed → Execute restart
5. Audit trail with full context
```

### Scenario 3: Denied Action

```
1. AI Engine recommends "delete_pod"
2. Policy Engine evaluation
   └─► Match: "Deny Destructive Actions During Peak Hours"
   └─► Time: 2:00 PM (peak hours)
   └─► Decision: DENY
3. Action blocked before execution
4. Log denial reason
5. Alert administrator
```

## API Interaction Patterns

### Pattern 1: AI-Driven Self-Healing

```typescript
// AI Engine (Python)
async function selfHealing() {
  // 1. Detect issue
  const anomaly = await detectAnomaly(metrics);
  
  // 2. Check policy
  const policyDecision = await fetch(POLICY_ENGINE_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: anomaly.recommended_action,
      resource: `cluster:${namespace}`,
      type: 'self_healing',
      context: {
        userId: 'ai-engine',
        role: 'service',
        metadata: { severity: anomaly.severity }
      }
    })
  });
  
  // 3. Execute if allowed
  if (policyDecision.allowed) {
    await executeAction(anomaly.recommended_action, params);
  }
}
```

### Pattern 2: User-Initiated Action

```typescript
// Backend API
async function userAction(user: User, action: string) {
  // 1. Authenticate user (JWT)
  // 2. Check policy
  const decision = await policyEngine.evaluate({
    action,
    resource: `/api/resource`,
    type: 'api_access',
    context: {
      userId: user.id,
      role: user.roles[0].name,
    }
  });
  
  // 3. Execute or deny
  if (decision.allowed) {
    return await performAction();
  } else {
    throw new ForbiddenException(decision.reason);
  }
}
```

## Monitoring & Observability

### Metrics to Track

**Backend**:
- Request rate by endpoint
- Authentication success/failure rate
- Policy evaluation duration
- Policy denial rate

**AI Engine**:
- Inference latency
- Anomaly detection rate
- Failure detection accuracy
- Model confidence scores

**Executor**:
- Action execution rate
- Success/failure ratio
- Execution duration
- Actions by namespace/type

### Health Checks

```bash
# Backend
curl http://localhost:3000/api/v1/health

# AI Engine
curl http://localhost:8000/health

# Executor
curl http://localhost:4000/health
```

### Audit Queries

```sql
-- Policy evaluations in last hour
SELECT * FROM policy_audit_logs 
WHERE "createdAt" > NOW() - INTERVAL '1 hour';

-- Failed executor actions
SELECT * FROM action_audit_logs 
WHERE status = 'failed';

-- AI predictions
SELECT * FROM prediction_history 
WHERE severity_score > 0.8;
```

## Security Considerations

### Defense in Depth

1. **Network Layer**: Service mesh, network policies
2. **Authentication**: JWT tokens, API keys
3. **Authorization**: Policy Engine with RBAC
4. **Action Validation**: HMAC signatures
5. **Audit Logging**: Immutable logs
6. **Rate Limiting**: Per-user, per-endpoint, per-action
7. **Namespace Isolation**: Restricted K8s access

### Secrets Management

```yaml
# Kubernetes Secrets
apiVersion: v1
kind: Secret
metadata:
  name: aegis-secrets
type: Opaque
data:
  jwt-secret: <base64>
  db-password: <base64>
  api-key: <base64>
```

## Disaster Recovery

### Backup Strategy

1. **Database Backups**: Daily automated backups
2. **Policy Definitions**: Version controlled in Git
3. **ML Models**: Stored in object storage
4. **Audit Logs**: Replicated to long-term storage

### Rollback Procedures

1. **Code Rollback**: Git revert + redeploy
2. **Database Rollback**: Restore from backup
3. **Kubernetes Rollback**: `kubectl rollout undo`
4. **Emergency Stop**: Disable self-healing policies

## Performance Benchmarks

| Operation | Latency | Throughput |
|-----------|---------|------------|
| Backend Auth | < 100ms | 1000 req/s |
| Policy Evaluation | < 50ms | 500 req/s |
| AI Anomaly Detection | < 100ms | 100 req/s |
| AI Failure Detection | < 200ms | 50 req/s |
| Executor Action | < 2s | 10 actions/s |

## Scaling Strategy

### Horizontal Scaling

- **Backend**: Scale to N replicas (stateless)
- **AI Engine**: Scale based on queue depth
- **Executor**: 2-3 replicas (leader election recommended)

### Resource Limits

```yaml
# Backend
resources:
  requests: { memory: "512Mi", cpu: "500m" }
  limits: { memory: "1Gi", cpu: "1000m" }

# AI Engine
resources:
  requests: { memory: "1Gi", cpu: "1000m" }
  limits: { memory: "2Gi", cpu: "2000m" }

# Executor
resources:
  requests: { memory: "256Mi", cpu: "250m" }
  limits: { memory: "512Mi", cpu: "500m" }
```

## Testing Strategy

### Unit Tests

```bash
# Backend
cd backend && npm run test

# AI Engine
cd ai-engine && pytest tests/

# Executor
cd executor && npm run test
```

### Integration Tests

1. Test policy evaluation flow
2. Test AI → Policy → Executor chain
3. Test action signatures
4. Test namespace restrictions
5. Test rate limiting

### Load Tests

- Simulate high metric volume
- Test concurrent action execution
- Verify rate limit enforcement
- Check database performance

## Production Checklist

### Backend
- [ ] Change JWT secrets
- [ ] Configure PostgreSQL SSL
- [ ] Set Redis password
- [ ] Review default policies
- [ ] Configure CORS properly

### AI Engine
- [ ] Set API key
- [ ] Configure Prometheus/Loki URLs
- [ ] Tune anomaly threshold
- [ ] Load pre-trained models
- [ ] Set up model retraining pipeline

### Executor
- [ ] Apply Kubernetes RBAC
- [ ] Set allowed namespaces
- [ ] Enable action signatures
- [ ] Configure Loki for audit logs
- [ ] Test all actions in staging

### Infrastructure
- [ ] Set up monitoring (Prometheus, Grafana)
- [ ] Configure alerting rules
- [ ] Enable log aggregation (Loki)
- [ ] Set up backup automation
- [ ] Test disaster recovery procedures

## Troubleshooting

### Backend Issues

```bash
# Check logs
docker logs aegis-backend

# Test database connection
psql -h localhost -U aegis_user -d aegis_db

# Verify Redis
redis-cli ping
```

### AI Engine Issues

```bash
# Check model loading
curl http://localhost:8000/health

# Check predictions
curl http://localhost:8000/api/v1/metrics/stats
```

### Executor Issues

```bash
# Check Kubernetes connection
kubectl auth can-i delete pods --as=system:serviceaccount:default:aegis-executor

# View audit logs
curl http://localhost:4000/audit/logs?limit=10
```

## Documentation

- **Backend**: [backend/README.md](backend/README.md)
- **Policy Engine**: [backend/POLICY_ENGINE.md](backend/POLICY_ENGINE.md)
- **AI Engine**: [ai-engine/README.md](ai-engine/README.md), [AI_ENGINE.md](AI_ENGINE.md)
- **Executor**: [executor/README.md](executor/README.md), [EXECUTOR.md](EXECUTOR.md)
- **Architecture**: This file

## Quick Start

```bash
# 1. Start Backend with Policy Engine
cd backend
docker-compose up -d

# 2. Start AI Engine
cd ../ai-engine
docker-compose up -d

# 3. Start Executor
cd ../executor
docker-compose up -d

# 4. Verify all services
curl http://localhost:3000/api/v1/health  # Backend
curl http://localhost:8000/health          # AI Engine
curl http://localhost:4000/health          # Executor
```

## License

MIT

## Support

For architecture questions or integration issues, consult the individual service READMEs or open an issue.
