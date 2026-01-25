#!/bin/bash

# Example: Scale a deployment
# This script demonstrates how to scale a deployment

EXECUTOR_URL="http://localhost:4000"
NAMESPACE="production"
DEPLOYMENT_NAME="api-deployment"
REPLICAS=5
REQUESTED_BY="ai-engine"

echo "Scaling deployment: $DEPLOYMENT_NAME to $REPLICAS replicas"

# Execute action
curl -X POST "$EXECUTOR_URL/executor/execute" \
  -H "Content-Type: application/json" \
  -d "{
    \"actionType\": \"scale_deployment\",
    \"actionParams\": {
      \"namespace\": \"$NAMESPACE\",
      \"deploymentName\": \"$DEPLOYMENT_NAME\",
      \"replicas\": $REPLICAS
    },
    \"requestedBy\": \"$REQUESTED_BY\",
    \"policyDecision\": {
      \"allowed\": true,
      \"reason\": \"High CPU usage detected\",
      \"appliedPolicies\": [\"Allow Auto-Scale\"]
    }
  }" | jq .

echo ""
echo "Scaling initiated. Monitor deployment status:"
echo "kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE"
