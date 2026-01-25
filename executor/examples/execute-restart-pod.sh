#!/bin/bash

# Example: Restart a pod
# This script demonstrates how to execute a pod restart action

EXECUTOR_URL="http://localhost:4000"
NAMESPACE="default"
POD_NAME="my-app-pod-xyz"
REQUESTED_BY="admin"

echo "Restarting pod: $POD_NAME in namespace: $NAMESPACE"

# Execute action
curl -X POST "$EXECUTOR_URL/executor/execute" \
  -H "Content-Type: application/json" \
  -d "{
    \"actionType\": \"restart_pod\",
    \"actionParams\": {
      \"namespace\": \"$NAMESPACE\",
      \"podName\": \"$POD_NAME\"
    },
    \"requestedBy\": \"$REQUESTED_BY\"
  }" | jq .

echo ""
echo "Action submitted. Check audit logs for status."
