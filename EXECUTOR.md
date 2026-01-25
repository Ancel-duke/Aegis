# Aegis Executor Service - Quick Start

Safe Kubernetes action execution with comprehensive audit logging.

## Quick Start

```bash
cd executor
npm install
cp .env.example .env
# Edit .env with your configuration
npm run start:dev
```

## Execute an Action

```bash
curl -X POST http://localhost:4000/executor/execute \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "restart_pod",
    "actionParams": {
      "namespace": "default",
      "podName": "my-app-pod-xyz"
    },
    "requestedBy": "admin"
  }'
```

## Supported Actions

### 1. Restart Pod
```json
{
  "actionType": "restart_pod",
  "actionParams": {
    "namespace": "default",
    "podName": "api-pod-12345"
  }
}
```

### 2. Scale Deployment
```json
{
  "actionType": "scale_deployment",
  "actionParams": {
    "namespace": "production",
    "deploymentName": "api-deployment",
    "replicas": 5
  }
}
```

### 3. Rollback Deployment
```json
{
  "actionType": "rollback_deployment",
  "actionParams": {
    "namespace": "production",
    "deploymentName": "api-deployment",
    "revision": 2
  }
}
```

## Security

### Required Kubernetes Service Account

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: aegis-executor
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: aegis-executor
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "delete"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "patch", "update"]
```

### Action Signatures

Generate signature for action:

```bash
curl -X POST http://localhost:4000/executor/generate-signature \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "restart_pod",
    "actionParams": {
      "namespace": "default",
      "podName": "test-pod"
    },
    "requestedBy": "admin"
  }'
```

## Configuration

Key `.env` settings:

```env
# Allowed namespaces (comma-separated)
ALLOWED_NAMESPACES=default,production,staging

# Signature validation
REQUIRE_ACTION_SIGNATURE=true
JWT_SECRET=your_secret_here

# Kubernetes
IN_CLUSTER=false
KUBECONFIG_PATH=/path/to/kubeconfig

# Audit logging
LOKI_URL=http://localhost:3100
```

## Audit Logs

### Query Logs

```bash
# Get recent actions
curl http://localhost:4000/audit/logs?limit=20

# Filter by type
curl http://localhost:4000/audit/logs?actionType=restart_pod

# Get statistics
curl http://localhost:4000/audit/statistics
```

### Database Schema

Audit logs stored in PostgreSQL with fields:
- Action type, status, namespace
- Resource type and name
- Request metadata
- Execution duration
- Error messages (if failed)
- Policy decisions
- HMAC signatures

## Integration

### With AI Engine

```python
# AI Engine executes remediation
response = await httpx.post(
    "http://executor:4000/executor/execute",
    json={
        "actionType": "scale_deployment",
        "actionParams": {
            "namespace": "production",
            "deploymentName": "api",
            "replicas": 10
        },
        "requestedBy": "ai-engine",
        "policyDecision": policy_result
    }
)
```

### With Policy Engine

```typescript
// Validate before execution
const policyCheck = await policyEngine.evaluate({
  action: 'restart_pod',
  resource: 'pod:api-pod',
  type: 'self_healing',
  context: { automated: true, severity: 'high' }
});

if (policyCheck.allowed) {
  await executor.execute(action);
}
```

## Health Checks

```bash
# Health status
curl http://localhost:4000/health

# Configuration
curl http://localhost:4000/health/config
```

## Rate Limiting

Prevents automation runaway:

```env
RATE_LIMIT_RESTART_TTL=300  # 5 min window
RATE_LIMIT_RESTART_MAX=5    # Max 5 restarts

RATE_LIMIT_SCALE_TTL=60     # 1 min window
RATE_LIMIT_SCALE_MAX=10     # Max 10 scales
```

## Testing

```bash
npm run test
npm run test:cov
```

## Production Checklist

- [ ] Configure Kubernetes service account
- [ ] Set allowed namespaces
- [ ] Enable action signatures
- [ ] Configure audit log retention
- [ ] Set up Loki for centralized logging
- [ ] Configure rate limits
- [ ] Set up monitoring alerts
- [ ] Test rollback procedures

## Troubleshooting

### Action Rejected

Check:
1. Namespace in allowed list
2. Action signature valid
3. Resource exists
4. Service account permissions

### Kubernetes Connection Failed

```bash
# Verify kubeconfig
kubectl cluster-info

# Check service account
kubectl auth can-i delete pods --as=system:serviceaccount:default:aegis-executor
```

## Documentation

- Full docs: [executor/README.md](executor/README.md)
- API examples: See README Integration section
- Test coverage: Run `npm run test:cov`
