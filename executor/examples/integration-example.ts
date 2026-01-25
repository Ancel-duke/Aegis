import * as crypto from 'crypto';
import axios from 'axios';

/**
 * Example: Full integration between AI Engine, Policy Engine, and Executor
 */

const EXECUTOR_URL = 'http://localhost:4000';
const POLICY_ENGINE_URL = 'http://localhost:3000/api/v1/policy/evaluate';
const JWT_SECRET = 'your_jwt_secret';

interface RemediationRequest {
  actionType: 'restart_pod' | 'scale_deployment' | 'rollback_deployment';
  actionParams: {
    namespace: string;
    podName?: string;
    deploymentName?: string;
    replicas?: number;
    revision?: number;
  };
  severity: string;
  reason: string;
}

/**
 * Generate HMAC signature for action
 */
function generateSignature(
  actionType: string,
  actionParams: any,
  requestedBy: string,
): string {
  const payload = JSON.stringify({
    actionType,
    actionParams,
    requestedBy,
  });

  return crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
}

/**
 * Check with Policy Engine if action is allowed
 */
async function checkPolicy(
  action: string,
  resource: string,
  context: any,
): Promise<{ allowed: boolean; reason: string; appliedPolicies: string[] }> {
  try {
    const response = await axios.post(POLICY_ENGINE_URL, {
      action,
      resource,
      type: 'self_healing',
      context,
    });

    return response.data;
  } catch (error) {
    console.error('Policy check failed:', error.message);
    return { allowed: false, reason: 'Policy check error', appliedPolicies: [] };
  }
}

/**
 * Execute remediation action
 */
async function executeRemediation(
  request: RemediationRequest,
): Promise<{ success: boolean; auditId: string; result?: any; error?: string }> {
  // Step 1: Check with Policy Engine
  console.log('Step 1: Checking with Policy Engine...');

  const policyDecision = await checkPolicy(
    request.actionType,
    `${request.actionParams.namespace}:${request.actionParams.podName || request.actionParams.deploymentName}`,
    {
      userId: 'ai-engine',
      role: 'service',
      metadata: {
        severity: request.severity,
        automated: true,
        reason: request.reason,
      },
    },
  );

  console.log('Policy decision:', policyDecision);

  if (!policyDecision.allowed) {
    console.error('❌ Action denied by policy:', policyDecision.reason);
    return {
      success: false,
      auditId: 'n/a',
      error: `Policy denied: ${policyDecision.reason}`,
    };
  }

  // Step 2: Generate action signature
  console.log('\nStep 2: Generating action signature...');

  const signature = generateSignature(
    request.actionType,
    request.actionParams,
    'ai-engine',
  );

  // Step 3: Execute action via Executor service
  console.log('\nStep 3: Executing action...');

  try {
    const response = await axios.post(`${EXECUTOR_URL}/executor/execute`, {
      actionType: request.actionType,
      actionParams: request.actionParams,
      requestedBy: 'ai-engine',
      policyDecision,
      signature,
    });

    console.log('✅ Action executed successfully');
    console.log('Audit ID:', response.data.auditId);
    console.log('Result:', response.data.result);

    return response.data;
  } catch (error) {
    console.error('❌ Action execution failed:', error.response?.data || error.message);
    return {
      success: false,
      auditId: 'error',
      error: error.response?.data?.message || error.message,
    };
  }
}

// Example 1: Restart a failing pod
async function example1_RestartPod() {
  console.log('='.repeat(60));
  console.log('Example 1: Restart Failing Pod');
  console.log('='.repeat(60));

  const result = await executeRemediation({
    actionType: 'restart_pod',
    actionParams: {
      namespace: 'default',
      podName: 'api-pod-12345',
    },
    severity: 'high',
    reason: 'Pod in CrashLoopBackOff',
  });

  console.log('\nFinal Result:', result);
}

// Example 2: Scale up deployment
async function example2_ScaleUp() {
  console.log('\n' + '='.repeat(60));
  console.log('Example 2: Scale Up Deployment');
  console.log('='.repeat(60));

  const result = await executeRemediation({
    actionType: 'scale_deployment',
    actionParams: {
      namespace: 'production',
      deploymentName: 'api-deployment',
      replicas: 8,
    },
    severity: 'high',
    reason: 'High CPU usage detected (>85%)',
  });

  console.log('\nFinal Result:', result);
}

// Example 3: Rollback deployment
async function example3_Rollback() {
  console.log('\n' + '='.repeat(60));
  console.log('Example 3: Rollback Deployment');
  console.log('='.repeat(60));

  const result = await executeRemediation({
    actionType: 'rollback_deployment',
    actionParams: {
      namespace: 'production',
      deploymentName: 'api-deployment',
      revision: 2,
    },
    severity: 'critical',
    reason: 'New deployment causing 50% error rate',
  });

  console.log('\nFinal Result:', result);
}

// Run examples
async function main() {
  try {
    await example1_RestartPod();
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await example2_ScaleUp();
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await example3_Rollback();
  } catch (error) {
    console.error('Example execution error:', error);
  }
}

// Uncomment to run
// main();

export { executeRemediation, checkPolicy, generateSignature };
