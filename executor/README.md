# Aegis Executor Service

Kubernetes action executor service that safely executes approved remediation actions with comprehensive audit logging and security controls.

## Features

- **Safe Kubernetes Operations**: Restart pods, scale deployments, rollback deployments
- **Immutable Audit Logging**: Every action logged to PostgreSQL and Loki
- **Security Controls**: JWT validation, action signatures, namespace restrictions, rate limiting
- **Policy Integration**: Validates actions with Policy Engine before execution
- **Least Privilege**: Runs as non-root user, requires specific Kubernetes service account
- **Comprehensive Error Handling**: Graceful failures with detailed error messages

## Architecture

### Actions Supported

1. **Restart Pod**: Delete a pod (will be recreated by deployment controller)
2. **Scale Deployment**: Change replica count for a deployment
3. **Rollback Deployment**: Revert to previous deployment revision

### Security Layers

1. **Namespace Whitelist**: Only allowed namespaces can be targeted
2. **Action Signatures**: HMAC-SHA256 signatures prevent tampering
3. **JWT Authentication**: Validates requests from Policy Engine
4. **Rate Limiting**: Prevents runaway automation
5. **Audit Logging**: Immutable logs of all actions

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL (for audit logs)
- Kubernetes cluster access
- kubectl configured

### Installation

1. **Install dependencies**:
```bash
cd executor
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Set up Kubernetes access**:
```bash
# For local development, use your kubeconfig
export KUBECONFIG_PATH=~/.kube/config

# For production, use in-cluster config
export IN_CLUSTER=true
```

4. **Run the service**:
```bash
npm run start:dev
```

## API Endpoints

### Execute Action

**POST** `/executor/execute`

Execute a Kubernetes action with full validation and audit logging.

```json
{
  "actionType": "restart_pod",
  "actionParams": {
    "namespace": "default",
    "podName": "api-pod-12345"
  },
  "requestedBy": "ai-engine",
  "policyDecision": {
    "allowed": true,
    "reason": "Allowed by policy",
    "appliedPolicies": ["Allow Self-Healing Actions"]
  },
  "signature": "a1b2c3d4..."
}
```

Response:
```json
{
  "success": true,
  "auditId": "uuid-here",
  "result": {
    "action": "restart_pod",
    "namespace": "default",
    "podName": "api-pod-12345",
    "status": "deleted",
    "message": "Pod deleted and will be recreated by deployment"
  }
}
```

### Generate Signature

**POST** `/executor/generate-signature`

Generate HMAC signature for an action (helper endpoint for testing).

```json
{
  "actionType": "restart_pod",
  "actionParams": {
    "namespace": "default",
    "podName": "test-pod"
  },
  "requestedBy": "admin"
}
```

### Audit Logs

**GET** `/audit/logs?actionType=restart_pod&status=completed&limit=50`

Query audit logs with filters.

**GET** `/audit/statistics`

Get action execution statistics.

### Health Checks

**GET** `/health` - Health status
**GET** `/health/ping` - Simple ping
**GET** `/health/config` - Configuration overview

## Action Types

### 1. Restart Pod

Deletes a pod, allowing the deployment controller to recreate it.

```typescript
{
  "actionType": "restart_pod",
  "actionParams": {
    "namespace": "default",
    "podName": "my-app-pod-xyz"
  }
}
```

**Use cases**:
- Pod is in CrashLoopBackOff
- Memory leak detected
- Application needs fresh start

### 2. Scale Deployment

Adjusts the number of replicas for a deployment.

```typescript
{
  "actionType": "scale_deployment",
  "actionParams": {
    "namespace": "production",
    "deploymentName": "api-deployment",
    "replicas": 5
  }
}
```

**Use cases**:
- High CPU/memory usage (scale up)
- Low traffic (scale down)
- Predictive scaling

### 3. Rollback Deployment

Reverts to a previous deployment revision.

```typescript
{
  "actionType": "rollback_deployment",
  "actionParams": {
    "namespace": "production",
    "deploymentName": "api-deployment",
    "revision": 2  // optional, defaults to previous
  }
}
```

**Use cases**:
- New deployment causing errors
- Performance regression
- Failed health checks

## Security

### Action Signatures

All actions must include an HMAC-SHA256 signature:

```typescript
import * as crypto from 'crypto';

const payload = JSON.stringify({
  actionType: 'restart_pod',
  actionParams: { namespace: 'default', podName: 'test-pod' },
  requestedBy: 'ai-engine'
});

const signature = crypto
  .createHmac('sha256', JWT_SECRET)
  .update(payload)
  .digest('hex');
```

### Namespace Restrictions

Configure allowed namespaces in `.env`:

```env
ALLOWED_NAMESPACES=default,production,staging
```

Actions targeting other namespaces will be rejected.

### Kubernetes Service Account

Create a service account with minimal required permissions:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: aegis-executor
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: aegis-executor
  namespace: default
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "delete"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "patch", "update"]
  - apiGroups: ["apps"]
    resources: ["deployments/rollback"]
    verbs: ["create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: aegis-executor
  namespace: default
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: aegis-executor
subjects:
  - kind: ServiceAccount
    name: aegis-executor
    namespace: default
```

### Rate Limiting

Configure per-action rate limits:

```env
RATE_LIMIT_RESTART_TTL=300  # 5 minutes
RATE_LIMIT_RESTART_MAX=5    # Max 5 restarts
RATE_LIMIT_SCALE_TTL=60     # 1 minute
RATE_LIMIT_SCALE_MAX=10     # Max 10 scale operations
```

## Integration Examples

### With AI Engine

```python
# AI Engine detects failure and recommends action
import httpx

async def execute_remediation(action_type: str, params: dict):
    # Generate signature
    payload = json.dumps({
        "actionType": action_type,
        "actionParams": params,
        "requestedBy": "ai-engine"
    })
    
    signature = hmac.new(
        JWT_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # Execute action
    response = await httpx.post(
        "http://executor:4000/executor/execute",
        json={
            "actionType": action_type,
            "actionParams": params,
            "requestedBy": "ai-engine",
            "signature": signature
        }
    )
    
    return response.json()
```

### With Policy Engine

```typescript
// Validate action with Policy Engine before execution
const policyDecision = await fetch('http://policy-engine:3000/api/v1/policy/evaluate', {
  method: 'POST',
  body: JSON.stringify({
    action: 'restart_pod',
    resource: 'pod:api-pod',
    type: 'self_healing',
    context: {
      userId: 'ai-engine',
      role: 'service',
      metadata: { severity: 'high', automated: true }
    }
  })
});

if (policyDecision.allowed) {
  // Execute action
  await executor.execute({ ...action, policyDecision });
}
```

## Audit Logging

All actions are logged to:

1. **PostgreSQL**: Structured, queryable audit logs
2. **Loki**: Centralized log aggregation

### Audit Log Fields

- `actionType`: Type of action executed
- `status`: pending | in_progress | completed | failed | rejected
- `namespace`: Kubernetes namespace
- `resourceType`: pod | deployment
- `resourceName`: Name of resource
- `actionParams`: Full action parameters
- `requestedBy`: User/service that requested action
- `policyDecision`: Policy Engine decision
- `executionDuration`: Time taken (ms)
- `errorMessage`: Error if failed
- `result`: Action result details
- `signature`: HMAC signature
- `createdAt`: Timestamp
- `completedAt`: Completion timestamp

## Testing

```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:cov

# Run specific test
npm run test -- executor.service.spec
```

## Error Handling

The service handles errors gracefully:

- **Resource not found**: Returns error, logs failure
- **Kubernetes API errors**: Captures and logs detailed error
- **Invalid namespace**: Rejects before execution
- **Invalid signature**: Rejects immediately
- **Rate limit exceeded**: Returns 429 error

All errors are logged to audit log with full context.

## Monitoring

### Health Checks

```bash
# Health status
curl http://localhost:4000/health

# Simple ping
curl http://localhost:4000/health/ping

# Configuration
curl http://localhost:4000/health/config
```

### Metrics to Track

- Action execution count by type
- Success/failure rates
- Execution duration
- Rate limit hits
- Namespace distribution

### Audit Log Queries

```sql
-- Failed actions in last hour
SELECT * FROM action_audit_logs 
WHERE status = 'failed' 
  AND "createdAt" > NOW() - INTERVAL '1 hour';

-- Actions by namespace
SELECT namespace, COUNT(*) 
FROM action_audit_logs 
GROUP BY namespace;

-- Average execution duration
SELECT actionType, AVG(executionDuration) as avg_duration_ms
FROM action_audit_logs 
WHERE status = 'completed'
GROUP BY actionType;
```

## Production Deployment

### Docker

```bash
# Build image
docker build -t aegis-executor .

# Run container
docker run -p 4000:4000 --env-file .env aegis-executor
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aegis-executor
spec:
  replicas: 2
  selector:
    matchLabels:
      app: aegis-executor
  template:
    metadata:
      labels:
        app: aegis-executor
    spec:
      serviceAccountName: aegis-executor
      containers:
        - name: executor
          image: aegis-executor:latest
          ports:
            - containerPort: 4000
          env:
            - name: IN_CLUSTER
              value: "true"
            - name: ALLOWED_NAMESPACES
              value: "default,production"
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

## Troubleshooting

### Kubernetes Connection Issues

```bash
# Check service account permissions
kubectl auth can-i delete pods --as=system:serviceaccount:default:aegis-executor

# View service logs
kubectl logs -f deployment/aegis-executor
```

### Action Failures

1. Check audit logs in database
2. Review error message in audit log
3. Verify resource exists in namespace
4. Check Kubernetes service account permissions

## Security Best Practices

1. **Least Privilege**: Only grant required Kubernetes permissions
2. **Namespace Isolation**: Restrict to specific namespaces
3. **Signature Validation**: Always validate action signatures
4. **Audit Everything**: Log all actions, successes and failures
5. **Rate Limiting**: Prevent automation runaway
6. **Monitoring**: Alert on high failure rates
7. **Regular Rotation**: Rotate JWT secrets regularly

## License

MIT
