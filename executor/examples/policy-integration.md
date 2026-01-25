# Executor + Policy Engine Integration

This guide demonstrates how the Executor service integrates with the Policy Engine for secure, policy-driven action execution.

## Workflow

```
┌─────────────┐
│  AI Engine  │
│  (detects   │
│   failure)  │
└──────┬──────┘
       │
       │ 1. Recommend action
       ▼
┌─────────────────┐
│ Policy Engine   │
│ (evaluates if   │
│  action allowed)│
└──────┬──────────┘
       │
       │ 2. Policy decision
       ▼
┌─────────────────┐
│ Executor Service│
│ (executes safe  │
│  K8s action)    │
└──────┬──────────┘
       │
       │ 3. Action result
       ▼
┌─────────────────┐
│ Kubernetes API  │
│ (pod restart,   │
│  scaling, etc)  │
└─────────────────┘
```

## Step-by-Step Integration

### Step 1: AI Engine Detects Issue

```python
# AI Engine detects anomaly
anomaly = await ai_engine.detect_anomaly(metrics)

if anomaly['is_anomaly'] and anomaly['severity'] == 'high':
    recommended_action = anomaly['recommended_action']
    # Proceed to policy check
```

### Step 2: Check with Policy Engine

```python
import requests

def check_policy(action: str, resource: str, context: dict) -> dict:
    """Check if action is allowed by policy"""
    response = requests.post(
        "http://localhost:3000/api/v1/policy/evaluate",
        json={
            "action": action,
            "resource": resource,
            "type": "self_healing",
            "context": context
        }
    )
    return response.json()

# Check policy
policy_decision = check_policy(
    action="restart_pod",
    resource="pod:api-pod-12345",
    context={
        "userId": "ai-engine",
        "role": "service",
        "metadata": {
            "severity": "high",
            "automated": True,
            "reason": "High error rate detected"
        }
    }
)

print(f"Policy decision: {policy_decision['allowed']}")
print(f"Reason: {policy_decision['reason']}")
```

### Step 3: Execute Action (if approved)

```python
import hmac
import hashlib
import json

def execute_action(
    action_type: str,
    action_params: dict,
    policy_decision: dict,
    jwt_secret: str
) -> dict:
    """Execute action via Executor service"""
    
    # Generate signature
    payload = json.dumps({
        "actionType": action_type,
        "actionParams": action_params,
        "requestedBy": "ai-engine"
    })
    
    signature = hmac.new(
        jwt_secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # Execute
    response = requests.post(
        "http://localhost:4000/executor/execute",
        json={
            "actionType": action_type,
            "actionParams": action_params,
            "requestedBy": "ai-engine",
            "policyDecision": policy_decision,
            "signature": signature
        }
    )
    
    return response.json()

# Execute if allowed
if policy_decision['allowed']:
    result = execute_action(
        action_type="restart_pod",
        action_params={
            "namespace": "default",
            "podName": "api-pod-12345"
        },
        policy_decision=policy_decision,
        jwt_secret="your_jwt_secret"
    )
    
    if result['success']:
        print(f"✅ Action executed successfully")
        print(f"   Audit ID: {result['auditId']}")
    else:
        print(f"❌ Action failed: {result['error']}")
```

## Complete Example

```python
async def handle_anomaly(metrics: list, logs: list):
    """Complete workflow: Detect -> Policy Check -> Execute"""
    
    # 1. Detect anomaly with AI Engine
    anomaly = await ai_engine.detect_anomaly(metrics)
    
    if not anomaly['is_anomaly']:
        return  # No action needed
    
    print(f"🔍 Anomaly detected: {anomaly['severity']}")
    print(f"   Recommended: {anomaly['recommended_action']}")
    
    # 2. Map AI recommendation to executor action
    action_mapping = {
        'scale_up': {
            'type': 'scale_deployment',
            'params': {
                'namespace': 'production',
                'deploymentName': 'api-deployment',
                'replicas': 10  # Increase from current
            }
        },
        'restart_pod': {
            'type': 'restart_pod',
            'params': {
                'namespace': 'production',
                'podName': extract_pod_name(metrics)
            }
        }
    }
    
    action = action_mapping.get(anomaly['recommended_action'])
    
    if not action:
        print(f"⚠️  No executor action for: {anomaly['recommended_action']}")
        return
    
    # 3. Check with Policy Engine
    policy_decision = check_policy(
        action=action['type'],
        resource=f"{action['params']['namespace']}:resource",
        context={
            "userId": "ai-engine",
            "role": "service",
            "metadata": {
                "severity": anomaly['severity'],
                "confidence": anomaly['confidence'],
                "automated": True
            }
        }
    )
    
    if not policy_decision['allowed']:
        print(f"❌ Policy denied: {policy_decision['reason']}")
        return
    
    print(f"✅ Policy approved: {policy_decision['reason']}")
    
    # 4. Execute action
    result = execute_action(
        action_type=action['type'],
        action_params=action['params'],
        policy_decision=policy_decision,
        jwt_secret=JWT_SECRET
    )
    
    # 5. Log result
    if result['success']:
        print(f"✅ Remediation successful")
        print(f"   Audit ID: {result['auditId']}")
    else:
        print(f"❌ Remediation failed: {result['error']}")
    
    return result
```

## Security Considerations

### 1. Action Signatures

Always include HMAC signature:

```python
# Generate signature
payload = json.dumps({
    "actionType": action_type,
    "actionParams": action_params,
    "requestedBy": requested_by
}, sort_keys=True)  # Important: sort keys for consistency

signature = hmac.new(
    jwt_secret.encode(),
    payload.encode(),
    hashlib.sha256
).hexdigest()
```

### 2. Policy Validation

Always check with Policy Engine first:

```python
if not policy_decision['allowed']:
    # Do not execute
    log_denied_action(action, policy_decision['reason'])
    return
```

### 3. Audit Logging

Every action is logged:

```sql
SELECT * FROM action_audit_logs 
WHERE "requestedBy" = 'ai-engine' 
  AND "createdAt" > NOW() - INTERVAL '1 hour'
ORDER BY "createdAt" DESC;
```

## Rate Limiting

Configure limits in `.env`:

```env
RATE_LIMIT_RESTART_TTL=300  # 5 minutes
RATE_LIMIT_RESTART_MAX=5    # Max 5 pod restarts

RATE_LIMIT_SCALE_TTL=60     # 1 minute
RATE_LIMIT_SCALE_MAX=10     # Max 10 scaling operations
```

## Error Handling

```python
try:
    result = client.execute_action(...)
    
    if not result['success']:
        # Handle execution failure
        error = result.get('error', 'Unknown error')
        audit_id = result.get('auditId')
        
        # Log to AI Engine's own logs
        logger.error(f"Action failed: {error}, Audit: {audit_id}")
        
        # Notify administrators if critical
        if severity == 'critical':
            await notify_admin(error, audit_id)

except requests.exceptions.Timeout:
    # Executor service timeout
    logger.error("Executor service timeout")

except requests.exceptions.ConnectionError:
    # Executor service unavailable
    logger.error("Cannot reach Executor service")
```

## Testing

```bash
# Test policy check
curl -X POST http://localhost:3000/api/v1/policy/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "restart_pod",
    "resource": "pod:test",
    "type": "self_healing",
    "context": {
      "userId": "ai-engine",
      "role": "service"
    }
  }'

# Test action execution
curl -X POST http://localhost:4000/executor/execute \
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

## Monitoring

Track these metrics:

- Action execution rate
- Success vs failure ratio
- Average execution duration
- Policy denial rate
- Actions by namespace
- Actions by type

## Best Practices

1. **Always check policy first**
2. **Include detailed context in policy checks**
3. **Handle executor failures gracefully**
4. **Log all attempts, not just successes**
5. **Monitor for high failure rates**
6. **Set up alerts for repeated failures**
7. **Review audit logs regularly**
8. **Test in staging before production**
