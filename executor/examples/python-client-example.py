"""
Example: Python client for Executor service
Demonstrates integration from AI Engine (Python) to Executor (Node.js)
"""

import hmac
import hashlib
import json
import requests
from datetime import datetime
from typing import Dict, Any, Optional


class ExecutorClient:
    """Client for Aegis Executor service"""
    
    def __init__(self, executor_url: str, jwt_secret: str):
        self.executor_url = executor_url
        self.jwt_secret = jwt_secret
    
    def generate_signature(
        self,
        action_type: str,
        action_params: Dict[str, Any],
        requested_by: str
    ) -> str:
        """Generate HMAC-SHA256 signature for action"""
        payload = json.dumps({
            "actionType": action_type,
            "actionParams": action_params,
            "requestedBy": requested_by
        }, sort_keys=True)
        
        signature = hmac.new(
            self.jwt_secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def execute_action(
        self,
        action_type: str,
        action_params: Dict[str, Any],
        requested_by: str = "ai-engine",
        policy_decision: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Execute a Kubernetes action"""
        
        # Generate signature
        signature = self.generate_signature(
            action_type,
            action_params,
            requested_by
        )
        
        # Prepare request
        payload = {
            "actionType": action_type,
            "actionParams": action_params,
            "requestedBy": requested_by,
            "signature": signature
        }
        
        if policy_decision:
            payload["policyDecision"] = policy_decision
        
        # Execute
        response = requests.post(
            f"{self.executor_url}/executor/execute",
            json=payload,
            timeout=30
        )
        
        response.raise_for_status()
        return response.json()
    
    def restart_pod(
        self,
        namespace: str,
        pod_name: str,
        policy_decision: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Restart a pod"""
        return self.execute_action(
            "restart_pod",
            {"namespace": namespace, "podName": pod_name},
            policy_decision=policy_decision
        )
    
    def scale_deployment(
        self,
        namespace: str,
        deployment_name: str,
        replicas: int,
        policy_decision: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Scale a deployment"""
        return self.execute_action(
            "scale_deployment",
            {
                "namespace": namespace,
                "deploymentName": deployment_name,
                "replicas": replicas
            },
            policy_decision=policy_decision
        )
    
    def rollback_deployment(
        self,
        namespace: str,
        deployment_name: str,
        revision: Optional[int] = None,
        policy_decision: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Rollback a deployment"""
        params = {
            "namespace": namespace,
            "deploymentName": deployment_name
        }
        
        if revision:
            params["revision"] = revision
        
        return self.execute_action(
            "rollback_deployment",
            params,
            policy_decision=policy_decision
        )


# Example usage
if __name__ == "__main__":
    # Initialize client
    client = ExecutorClient(
        executor_url="http://localhost:4000",
        jwt_secret="your_jwt_secret"
    )
    
    # Example 1: Restart a pod
    print("Example 1: Restarting pod...")
    try:
        result = client.restart_pod(
            namespace="default",
            pod_name="api-pod-12345",
            policy_decision={
                "allowed": True,
                "reason": "Self-healing triggered by AI",
                "appliedPolicies": ["Allow Auto-Restart"]
            }
        )
        print(f"✅ Success: {result}")
        print(f"   Audit ID: {result['auditId']}")
    except Exception as e:
        print(f"❌ Failed: {e}")
    
    print("\n" + "="*60)
    
    # Example 2: Scale deployment
    print("Example 2: Scaling deployment...")
    try:
        result = client.scale_deployment(
            namespace="production",
            deployment_name="api-deployment",
            replicas=10,
            policy_decision={
                "allowed": True,
                "reason": "High CPU usage detected",
                "appliedPolicies": ["Allow Auto-Scale"]
            }
        )
        print(f"✅ Success: {result}")
        print(f"   Previous replicas: {result['result']['previousReplicas']}")
        print(f"   New replicas: {result['result']['newReplicas']}")
    except Exception as e:
        print(f"❌ Failed: {e}")
    
    print("\n" + "="*60)
    
    # Example 3: Rollback deployment
    print("Example 3: Rolling back deployment...")
    try:
        result = client.rollback_deployment(
            namespace="production",
            deployment_name="api-deployment",
            revision=2,
            policy_decision={
                "allowed": True,
                "reason": "New version causing errors",
                "appliedPolicies": ["Allow Emergency Rollback"]
            }
        )
        print(f"✅ Success: {result}")
    except Exception as e:
        print(f"❌ Failed: {e}")
