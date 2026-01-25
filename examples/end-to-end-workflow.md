# End-to-End Workflow Example

This document demonstrates a complete self-healing workflow across all Aegis services.

## Scenario: High CPU Triggers Auto-Scaling

### Step 1: System Detects High CPU

Prometheus collects metrics showing high CPU usage:

```
api-pod-1: CPU 92%
api-pod-2: CPU 89%
api-pod-3: CPU 95%
```

### Step 2: AI Engine Analyzes Metrics

```bash
# AI Engine receives metrics (could be from a scheduled job)
curl -X POST http://localhost:8000/api/v1/detect-anomaly \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev_api_key" \
  -d '{
    "metrics": [
      {
        "metric_type": "cpu_usage",
        "value": 92.0,
        "timestamp": "2024-01-25T14:00:00Z",
        "labels": {"pod": "api-pod-1", "namespace": "production"}
      },
      {
        "metric_type": "cpu_usage",
        "value": 89.0,
        "timestamp": "2024-01-25T14:00:00Z",
        "labels": {"pod": "api-pod-2", "namespace": "production"}
      },
      {
        "metric_type": "cpu_usage",
        "value": 95.0,
        "timestamp": "2024-01-25T14:00:00Z",
        "labels": {"pod": "api-pod-3", "namespace": "production"}
      }
    ],
    "context": {
      "deployment": "api-deployment",
      "namespace": "production"
    }
  }'
```

**Response**:
```json
{
  "is_anomaly": true,
  "anomaly_score": 0.87,
  "severity": "high",
  "recommended_action": "scale_up",
  "confidence": 0.92,
  "affected_metrics": ["cpu_usage"],
  "details": {
    "affected_features": ["cpu_usage_mean", "cpu_usage_max"],
    "model_confidence": 0.92
  },
  "timestamp": "2024-01-25T14:00:01Z"
}
```

### Step 3: Check with Policy Engine

Before executing, verify the action is allowed:

```bash
curl -X POST http://localhost:3000/api/v1/policy/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "scale_up",
    "resource": "deployment:api-deployment",
    "type": "self_healing",
    "context": {
      "userId": "ai-engine",
      "role": "service",
      "metadata": {
        "severity": "high",
        "confidence": 0.92,
        "automated": true,
        "currentCpuUsage": 92,
        "namespace": "production"
      }
    }
  }'
```

**Response**:
```json
{
  "allowed": true,
  "reason": "Allowed by policy: Allow Auto-Scale on High Load",
  "appliedPolicies": ["Allow Auto-Scale on High Load"]
}
```

### Step 4: Execute Scaling Action

With policy approval, execute the scaling:

```bash
# First, generate the action signature
curl -X POST http://localhost:4000/executor/generate-signature \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "scale_deployment",
    "actionParams": {
      "namespace": "production",
      "deploymentName": "api-deployment",
      "replicas": 8
    },
    "requestedBy": "ai-engine"
  }'

# Response: { "signature": "a1b2c3d4e5f6..." }

# Then execute with signature
curl -X POST http://localhost:4000/executor/execute \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "scale_deployment",
    "actionParams": {
      "namespace": "production",
      "deploymentName": "api-deployment",
      "replicas": 8
    },
    "requestedBy": "ai-engine",
    "policyDecision": {
      "allowed": true,
      "reason": "Allowed by policy: Allow Auto-Scale on High Load",
      "appliedPolicies": ["Allow Auto-Scale on High Load"]
    },
    "signature": "a1b2c3d4e5f6..."
  }'
```

**Response**:
```json
{
  "success": true,
  "auditId": "uuid-audit-123",
  "result": {
    "action": "scale_deployment",
    "namespace": "production",
    "deploymentName": "api-deployment",
    "previousReplicas": 3,
    "newReplicas": 8,
    "status": "scaled"
  }
}
```

### Step 5: Verify Scaling

```bash
# Check Kubernetes
kubectl get deployment api-deployment -n production

# Check audit logs
curl http://localhost:4000/audit/logs?limit=1

# Check AI Engine stats
curl http://localhost:8000/api/v1/metrics/stats
```

## Automated Script

Here's a complete automated script:

```python
import requests
import hmac
import hashlib
import json
from typing import Dict, Any

# Configuration
AI_ENGINE_URL = "http://localhost:8000"
POLICY_ENGINE_URL = "http://localhost:3000/api/v1"
EXECUTOR_URL = "http://localhost:4000"
AI_API_KEY = "dev_api_key"
JWT_SECRET = "your_jwt_secret"

def detect_anomaly(metrics: list) -> Dict[str, Any]:
    """Step 1: Detect anomaly"""
    response = requests.post(
        f"{AI_ENGINE_URL}/api/v1/detect-anomaly",
        json={"metrics": metrics},
        headers={"X-API-Key": AI_API_KEY}
    )
    return response.json()

def check_policy(action: str, resource: str, context: dict) -> Dict[str, Any]:
    """Step 2: Check policy"""
    response = requests.post(
        f"{POLICY_ENGINE_URL}/policy/evaluate",
        json={
            "action": action,
            "resource": resource,
            "type": "self_healing",
            "context": context
        }
    )
    return response.json()

def generate_signature(action_type: str, action_params: dict, requested_by: str) -> str:
    """Generate HMAC signature"""
    payload = json.dumps({
        "actionType": action_type,
        "actionParams": action_params,
        "requestedBy": requested_by
    }, sort_keys=True)
    
    return hmac.new(
        JWT_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

def execute_action(
    action_type: str,
    action_params: dict,
    policy_decision: dict,
    requested_by: str = "ai-engine"
) -> Dict[str, Any]:
    """Step 3: Execute action"""
    signature = generate_signature(action_type, action_params, requested_by)
    
    response = requests.post(
        f"{EXECUTOR_URL}/executor/execute",
        json={
            "actionType": action_type,
            "actionParams": action_params,
            "requestedBy": requested_by,
            "policyDecision": policy_decision,
            "signature": signature
        }
    )
    return response.json()

def self_healing_workflow():
    """Complete self-healing workflow"""
    
    # Simulate incoming metrics
    metrics = [
        {
            "metric_type": "cpu_usage",
            "value": 92.0,
            "timestamp": "2024-01-25T14:00:00Z",
            "labels": {"pod": "api-pod-1", "namespace": "production"}
        },
        {
            "metric_type": "cpu_usage",
            "value": 89.0,
            "timestamp": "2024-01-25T14:00:00Z",
            "labels": {"pod": "api-pod-2", "namespace": "production"}
        },
        {
            "metric_type": "cpu_usage",
            "value": 95.0,
            "timestamp": "2024-01-25T14:00:00Z",
            "labels": {"pod": "api-pod-3", "namespace": "production"}
        }
    ]
    
    print("=" * 70)
    print("AEGIS SELF-HEALING WORKFLOW")
    print("=" * 70)
    
    # Step 1: Detect anomaly
    print("\n[1/4] Analyzing metrics with AI Engine...")
    anomaly = detect_anomaly(metrics)
    
    print(f"      Anomaly detected: {anomaly['is_anomaly']}")
    print(f"      Severity: {anomaly['severity']}")
    print(f"      Recommended action: {anomaly['recommended_action']}")
    print(f"      Confidence: {anomaly['confidence']:.2f}")
    
    if not anomaly['is_anomaly'] or anomaly['severity'] == 'low':
        print("\n✓ No action needed")
        return
    
    # Step 2: Check policy
    print("\n[2/4] Checking with Policy Engine...")
    policy_decision = check_policy(
        action=anomaly['recommended_action'],
        resource="deployment:api-deployment",
        context={
            "userId": "ai-engine",
            "role": "service",
            "metadata": {
                "severity": anomaly['severity'],
                "confidence": anomaly['confidence'],
                "automated": True,
                "namespace": "production"
            }
        }
    )
    
    print(f"      Policy decision: {policy_decision['allowed']}")
    print(f"      Reason: {policy_decision['reason']}")
    
    if not policy_decision['allowed']:
        print("\n✗ Action denied by policy")
        print(f"  Reason: {policy_decision['reason']}")
        return
    
    # Step 3: Map AI recommendation to executor action
    print("\n[3/4] Mapping to executor action...")
    
    if anomaly['recommended_action'] == 'scale_up':
        action_params = {
            "namespace": "production",
            "deploymentName": "api-deployment",
            "replicas": 8  # Scale from current 3 to 8
        }
        action_type = "scale_deployment"
    elif anomaly['recommended_action'] == 'restart_pod':
        action_params = {
            "namespace": "production",
            "podName": "api-pod-1"
        }
        action_type = "restart_pod"
    else:
        print(f"\n✗ Unknown action: {anomaly['recommended_action']}")
        return
    
    print(f"      Action: {action_type}")
    print(f"      Params: {json.dumps(action_params, indent=8)}")
    
    # Step 4: Execute action
    print("\n[4/4] Executing action via Executor service...")
    result = execute_action(action_type, action_params, policy_decision)
    
    if result['success']:
        print(f"\n✓ Action executed successfully!")
        print(f"  Audit ID: {result['auditId']}")
        print(f"  Result: {json.dumps(result['result'], indent=4)}")
    else:
        print(f"\n✗ Action execution failed")
        print(f"  Error: {result.get('error', 'Unknown error')}")
        print(f"  Audit ID: {result.get('auditId', 'N/A')}")
    
    print("\n" + "=" * 70)
    print("WORKFLOW COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    try:
        self_healing_workflow()
    except Exception as e:
        print(f"\n✗ Workflow error: {e}")
```

## Expected Output

```
======================================================================
AEGIS SELF-HEALING WORKFLOW
======================================================================

[1/4] Analyzing metrics with AI Engine...
      Anomaly detected: True
      Severity: high
      Recommended action: scale_up
      Confidence: 0.92

[2/4] Checking with Policy Engine...
      Policy decision: True
      Reason: Allowed by policy: Allow Auto-Scale on High Load

[3/4] Mapping to executor action...
      Action: scale_deployment
      Params: {
        "namespace": "production",
        "deploymentName": "api-deployment",
        "replicas": 8
      }

[4/4] Executing action via Executor service...

✓ Action executed successfully!
  Audit ID: 550e8400-e29b-41d4-a716-446655440000
  Result: {
    "action": "scale_deployment",
    "namespace": "production",
    "deploymentName": "api-deployment",
    "previousReplicas": 3,
    "newReplicas": 8,
    "status": "scaled"
  }

======================================================================
WORKFLOW COMPLETE
======================================================================
```

## Audit Trail

After execution, you can query the audit trail:

### Backend - Policy Evaluation Log

```bash
curl http://localhost:3000/api/v1/policy/audit/logs?limit=1
```

```json
{
  "userId": "ai-engine",
  "action": "scale_up",
  "resource": "deployment:api-deployment",
  "result": "allow",
  "appliedPolicies": ["Allow Auto-Scale on High Load"],
  "context": {
    "severity": "high",
    "confidence": 0.92,
    "automated": true
  },
  "timestamp": "2024-01-25T14:00:02Z"
}
```

### AI Engine - Prediction History

```bash
curl http://localhost:8000/api/v1/metrics/predictions?limit=1
```

```json
{
  "predictions": [{
    "id": 1,
    "timestamp": "2024-01-25T14:00:01Z",
    "model_type": "anomaly",
    "severity_score": 0.87,
    "recommended_action": "scale_up",
    "prediction": {
      "is_anomaly": true,
      "affected_metrics": ["cpu_usage"]
    }
  }]
}
```

### Executor - Action Audit Log

```bash
curl http://localhost:4000/audit/logs?limit=1
```

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "actionType": "scale_deployment",
  "status": "completed",
  "namespace": "production",
  "resourceType": "deployment",
  "resourceName": "api-deployment",
  "actionParams": {
    "namespace": "production",
    "deploymentName": "api-deployment",
    "replicas": 8
  },
  "requestedBy": "ai-engine",
  "executionDuration": 1234,
  "result": {
    "previousReplicas": 3,
    "newReplicas": 8,
    "status": "scaled"
  },
  "createdAt": "2024-01-25T14:00:03Z",
  "completedAt": "2024-01-25T14:00:04Z"
}
```

## Error Scenario: Policy Denial

What happens if the policy denies the action?

### Scenario: Scaling During Maintenance Window

```bash
# Same anomaly detected, but during maintenance
curl -X POST http://localhost:3000/api/v1/policy/evaluate \
  -d '{
    "action": "scale_up",
    "resource": "deployment:api-deployment",
    "type": "self_healing",
    "context": {
      "userId": "ai-engine",
      "role": "service",
      "metadata": {
        "maintenanceMode": true
      }
    }
  }'
```

**Response**:
```json
{
  "allowed": false,
  "reason": "Denied by policy: Block Auto-Scaling During Maintenance",
  "appliedPolicies": ["Block Auto-Scaling During Maintenance"]
}
```

**Result**: 
- Action is NOT executed
- Denial is logged to policy audit trail
- Administrator is notified
- System waits for manual intervention

## Complete Integration Code

```typescript
// integration.ts - Complete workflow implementation

import axios from 'axios';
import * as crypto from 'crypto';

interface AnomalyResult {
  is_anomaly: boolean;
  severity: string;
  recommended_action: string;
  confidence: number;
}

interface PolicyDecision {
  allowed: boolean;
  reason: string;
  appliedPolicies: string[];
}

interface ActionResult {
  success: boolean;
  auditId: string;
  result?: any;
  error?: string;
}

class AegisOrchestrator {
  constructor(
    private aiEngineUrl: string,
    private policyEngineUrl: string,
    private executorUrl: string,
    private aiApiKey: string,
    private jwtSecret: string,
  ) {}

  async handleAnomaly(metrics: any[]): Promise<void> {
    console.log('🔍 Starting anomaly detection...');

    // Step 1: Detect anomaly
    const anomaly = await this.detectAnomaly(metrics);

    if (!anomaly.is_anomaly) {
      console.log('✓ No anomaly detected');
      return;
    }

    console.log(`⚠️  Anomaly detected!`);
    console.log(`   Severity: ${anomaly.severity}`);
    console.log(`   Recommended: ${anomaly.recommended_action}`);

    // Step 2: Check policy
    const policyDecision = await this.checkPolicy(anomaly);

    if (!policyDecision.allowed) {
      console.log(`❌ Policy denied: ${policyDecision.reason}`);
      await this.notifyAdmin(anomaly, policyDecision);
      return;
    }

    console.log(`✅ Policy approved: ${policyDecision.reason}`);

    // Step 3: Execute action
    const actionResult = await this.executeRemediation(anomaly, policyDecision);

    if (actionResult.success) {
      console.log(`✅ Action executed successfully`);
      console.log(`   Audit ID: ${actionResult.auditId}`);
    } else {
      console.log(`❌ Action failed: ${actionResult.error}`);
      await this.notifyAdmin(anomaly, policyDecision, actionResult);
    }
  }

  private async detectAnomaly(metrics: any[]): Promise<AnomalyResult> {
    const response = await axios.post(
      `${this.aiEngineUrl}/api/v1/detect-anomaly`,
      { metrics },
      { headers: { 'X-API-Key': this.aiApiKey } },
    );
    return response.data;
  }

  private async checkPolicy(anomaly: AnomalyResult): Promise<PolicyDecision> {
    const response = await axios.post(
      `${this.policyEngineUrl}/policy/evaluate`,
      {
        action: anomaly.recommended_action,
        resource: 'deployment:api-deployment',
        type: 'self_healing',
        context: {
          userId: 'ai-engine',
          role: 'service',
          metadata: {
            severity: anomaly.severity,
            confidence: anomaly.confidence,
            automated: true,
          },
        },
      },
    );
    return response.data;
  }

  private async executeRemediation(
    anomaly: AnomalyResult,
    policyDecision: PolicyDecision,
  ): Promise<ActionResult> {
    // Map AI recommendation to executor action
    const actionMapping = {
      scale_up: {
        type: 'scale_deployment',
        params: {
          namespace: 'production',
          deploymentName: 'api-deployment',
          replicas: 8,
        },
      },
      restart_pod: {
        type: 'restart_pod',
        params: {
          namespace: 'production',
          podName: 'api-pod-1',
        },
      },
    };

    const action = actionMapping[anomaly.recommended_action];

    if (!action) {
      return {
        success: false,
        auditId: 'n/a',
        error: `No executor action for: ${anomaly.recommended_action}`,
      };
    }

    // Generate signature
    const signature = this.generateSignature(
      action.type,
      action.params,
      'ai-engine',
    );

    // Execute
    const response = await axios.post(`${this.executorUrl}/executor/execute`, {
      actionType: action.type,
      actionParams: action.params,
      requestedBy: 'ai-engine',
      policyDecision,
      signature,
    });

    return response.data;
  }

  private generateSignature(
    actionType: string,
    actionParams: any,
    requestedBy: string,
  ): string {
    const payload = JSON.stringify({
      actionType,
      actionParams,
      requestedBy,
    });

    return crypto
      .createHmac('sha256', this.jwtSecret)
      .update(payload)
      .digest('hex');
  }

  private async notifyAdmin(
    anomaly: AnomalyResult,
    policyDecision: PolicyDecision,
    actionResult?: ActionResult,
  ): Promise<void> {
    // Send notification (email, Slack, PagerDuty, etc.)
    console.log('📧 Notifying administrator...');
  }
}

// Usage
const orchestrator = new AegisOrchestrator(
  'http://localhost:8000',
  'http://localhost:3000/api/v1',
  'http://localhost:4000',
  'dev_api_key',
  'your_jwt_secret',
);

// Simulate monitoring loop
async function monitoringLoop() {
  // In production, this would fetch real metrics from Prometheus
  const metrics = [
    /* ... metric data ... */
  ];

  try {
    await orchestrator.handleAnomaly(metrics);
  } catch (error) {
    console.error('Workflow error:', error);
  }
}

// Run every 30 seconds
setInterval(monitoringLoop, 30000);
```

## Testing the Complete Flow

### 1. Start All Services

```bash
# Terminal 1: Backend
cd backend && docker-compose up

# Terminal 2: AI Engine
cd ai-engine && docker-compose up

# Terminal 3: Executor
cd executor && docker-compose up
```

### 2. Seed Policies

```bash
cd backend
npx ts-node src/policy/scripts/seed-policies.ts
```

### 3. Run End-to-End Test

```bash
# Save the workflow script
python examples/end-to-end-workflow.py

# Or use the TypeScript version
ts-node examples/end-to-end-workflow.ts
```

### 4. Verify Results

```bash
# Check all audit trails
curl http://localhost:3000/api/v1/policy/audit/logs?limit=5
curl http://localhost:8000/api/v1/metrics/predictions?limit=5
curl http://localhost:4000/audit/logs?limit=5

# Check Kubernetes
kubectl get deployments -n production
kubectl get pods -n production
```

## Monitoring the Workflow

### Grafana Dashboard (Recommended)

Create dashboards showing:

1. **Anomalies Detected**: Count over time
2. **Policy Decisions**: Allow vs Deny ratio
3. **Actions Executed**: By type and status
4. **Execution Duration**: Per action type
5. **Failure Rate**: Failed actions percentage

### Alert Rules

Set up alerts for:
- High anomaly detection rate
- High policy denial rate
- Failed action executions
- Long execution durations
- Repeated failures on same resource

## Troubleshooting

### Issue: Actions Not Executing

Check:
1. AI Engine detected anomaly? → Check `/api/v1/metrics/predictions`
2. Policy approved action? → Check policy audit logs
3. Executor received request? → Check executor logs
4. Kubernetes permissions? → Check service account RBAC

### Issue: False Positives

Tune AI Engine:
```env
ANOMALY_THRESHOLD=0.90  # Increase threshold
MIN_SAMPLES_FOR_TRAINING=200  # More training data
```

### Issue: Policy Denials

Review policies:
```bash
# List policies
curl http://localhost:3000/api/v1/policy

# Check specific policy
curl http://localhost:3000/api/v1/policy/{policy-id}
```

## Best Practices

1. **Test in Staging First**: Always test self-healing in non-production
2. **Monitor Audit Logs**: Regularly review all three audit trails
3. **Gradual Rollout**: Start with low-risk actions (scaling) before critical ones (rollbacks)
4. **Set Conservative Limits**: Use strict rate limits initially
5. **Alert on Failures**: Set up alerts for failed executions
6. **Regular Reviews**: Review and tune policies monthly
7. **Backup Everything**: Maintain backups of all audit logs

## Success Metrics

Track these KPIs:

- **MTTR** (Mean Time To Recovery): Time from detection to resolution
- **Automation Rate**: % of issues resolved automatically
- **False Positive Rate**: Incorrect anomaly detections
- **Policy Accuracy**: Correct allow/deny decisions
- **Action Success Rate**: % of successful action executions

Target values:
- MTTR: < 2 minutes
- Automation Rate: > 80%
- False Positive Rate: < 5%
- Action Success Rate: > 95%
