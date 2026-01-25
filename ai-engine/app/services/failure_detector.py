import numpy as np
from sklearn.ensemble import RandomForestClassifier
from typing import Tuple, List, Dict, Any
import logging

from app.schemas.inference import SeverityLevel, RemediationAction

logger = logging.getLogger(__name__)


class FailureDetector:
    """Detect failure patterns for self-healing"""
    
    def __init__(self):
        """Initialize failure detector"""
        self.classifier = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            class_weight='balanced'
        )
        
        self.is_trained = False
        self.failure_types = ['service_down', 'high_latency', 'memory_leak', 'connection_timeout']
    
    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        """
        Train the failure detection model
        
        Args:
            X: Training features (n_samples, n_features)
            y: Training labels (n_samples,)
        """
        if X.shape[0] < 10:
            logger.warning("Insufficient training samples for failure detection")
            return
        
        try:
            self.classifier.fit(X, y)
            self.is_trained = True
            logger.info(f"Failure detector trained with {X.shape[0]} samples")
        except Exception as e:
            logger.error(f"Error training failure detector: {e}")
    
    def predict(
        self,
        X: np.ndarray,
        feature_names: list = None
    ) -> Tuple[bool, str, SeverityLevel, List[RemediationAction], float, str, List[str], Dict[str, Any]]:
        """
        Predict if a failure pattern is detected
        
        Args:
            X: Input features (1, n_features)
            feature_names: Names of features
            
        Returns:
            Tuple of (failure_detected, failure_type, severity, actions, confidence, root_cause, affected_services, details)
        """
        if not self.is_trained:
            logger.warning("Model not trained, using heuristic-based detection")
            return self._heuristic_detection(X, feature_names)
        
        try:
            # Predict failure probability
            proba = self.classifier.predict_proba(X)[0]
            prediction = self.classifier.predict(X)[0]
            
            confidence = float(np.max(proba))
            failure_detected = prediction == 1
            
            if failure_detected:
                failure_type = self._identify_failure_type(X, feature_names)
                severity = self._determine_failure_severity(confidence, X, feature_names)
                actions = self._recommend_remediation_actions(failure_type, severity)
                root_cause = self._analyze_root_cause(X, feature_names)
                affected_services = self._identify_affected_services(X, feature_names)
            else:
                failure_type = None
                severity = SeverityLevel.LOW
                actions = [RemediationAction.NO_ACTION]
                root_cause = None
                affected_services = []
            
            details = {
                "confidence": confidence,
                "prediction_probability": float(proba[1]) if len(proba) > 1 else confidence,
                "feature_importance": self._get_feature_importance(feature_names)
            }
            
            return failure_detected, failure_type, severity, actions, confidence, root_cause, affected_services, details
            
        except Exception as e:
            logger.error(f"Error during failure prediction: {e}")
            return False, None, SeverityLevel.LOW, [RemediationAction.NO_ACTION], 0.0, None, [], {"error": str(e)}
    
    def _heuristic_detection(
        self,
        X: np.ndarray,
        feature_names: list = None
    ) -> Tuple[bool, str, SeverityLevel, List[RemediationAction], float, str, List[str], Dict[str, Any]]:
        """Heuristic-based failure detection when model is not trained"""
        if X.size == 0 or not feature_names:
            return False, None, SeverityLevel.LOW, [RemediationAction.NO_ACTION], 0.0, None, [], {}
        
        feature_dict = dict(zip(feature_names, X[0]))
        
        # Check error rate
        error_rate = feature_dict.get('error_rate', 0)
        error_count = feature_dict.get('error_count', 0)
        
        if error_rate > 0.2 or error_count > 50:
            return (
                True,
                'high_error_rate',
                SeverityLevel.HIGH,
                [RemediationAction.RESTART_POD, RemediationAction.ALERT_ADMIN],
                0.8,
                f"High error rate detected: {error_rate:.2%}",
                ['api-service'],
                {"heuristic": True, "error_rate": error_rate}
            )
        
        # Check for connection issues
        if 'keyword_connection' in feature_dict and feature_dict['keyword_connection'] > 10:
            return (
                True,
                'connection_timeout',
                SeverityLevel.MEDIUM,
                [RemediationAction.RESTART_POD],
                0.7,
                "Multiple connection timeout errors detected",
                ['database', 'api-service'],
                {"heuristic": True}
            )
        
        return False, None, SeverityLevel.LOW, [RemediationAction.NO_ACTION], 0.0, None, [], {}
    
    def _identify_failure_type(self, X: np.ndarray, feature_names: list = None) -> str:
        """Identify the type of failure"""
        if not feature_names or X.size == 0:
            return "unknown"
        
        feature_dict = dict(zip(feature_names, X[0]))
        
        # Simple heuristics
        if feature_dict.get('error_rate', 0) > 0.3:
            return 'service_down'
        elif feature_dict.get('keyword_timeout', 0) > 5:
            return 'connection_timeout'
        elif feature_dict.get('keyword_exception', 0) > 10:
            return 'unhandled_exception'
        else:
            return 'unknown'
    
    def _determine_failure_severity(
        self,
        confidence: float,
        X: np.ndarray,
        feature_names: list = None
    ) -> SeverityLevel:
        """Determine severity of the failure"""
        if confidence >= 0.9:
            return SeverityLevel.CRITICAL
        elif confidence >= 0.7:
            return SeverityLevel.HIGH
        elif confidence >= 0.5:
            return SeverityLevel.MEDIUM
        else:
            return SeverityLevel.LOW
    
    def _recommend_remediation_actions(
        self,
        failure_type: str,
        severity: SeverityLevel
    ) -> List[RemediationAction]:
        """Recommend remediation actions based on failure type"""
        actions_map = {
            'service_down': [RemediationAction.RESTART_POD, RemediationAction.ALERT_ADMIN],
            'high_latency': [RemediationAction.SCALE_UP, RemediationAction.THROTTLE_API],
            'memory_leak': [RemediationAction.RESTART_POD, RemediationAction.ALERT_ADMIN],
            'connection_timeout': [RemediationAction.RESTART_POD, RemediationAction.SCALE_UP],
            'unknown': [RemediationAction.ALERT_ADMIN]
        }
        
        actions = actions_map.get(failure_type, [RemediationAction.ALERT_ADMIN])
        
        # Add alerting for high severity
        if severity in [SeverityLevel.HIGH, SeverityLevel.CRITICAL]:
            if RemediationAction.ALERT_ADMIN not in actions:
                actions.append(RemediationAction.ALERT_ADMIN)
        
        return actions
    
    def _analyze_root_cause(self, X: np.ndarray, feature_names: list = None) -> str:
        """Analyze root cause of the failure"""
        if not feature_names or X.size == 0:
            return "Unable to determine root cause"
        
        feature_dict = dict(zip(feature_names, X[0]))
        
        # Find dominant error patterns
        causes = []
        
        if feature_dict.get('error_rate', 0) > 0.2:
            causes.append(f"High error rate ({feature_dict['error_rate']:.2%})")
        
        if feature_dict.get('keyword_timeout', 0) > 5:
            causes.append("Multiple timeout errors")
        
        if feature_dict.get('keyword_connection', 0) > 5:
            causes.append("Connection failures")
        
        if causes:
            return " and ".join(causes)
        
        return "Anomalous behavior detected"
    
    def _identify_affected_services(self, X: np.ndarray, feature_names: list = None) -> List[str]:
        """Identify which services are affected"""
        # In a real implementation, this would parse service-specific metrics
        # For now, return common services
        return ['api-service', 'worker-service']
    
    def _get_feature_importance(self, feature_names: list = None) -> Dict[str, float]:
        """Get feature importance from the model"""
        if not self.is_trained or not feature_names:
            return {}
        
        try:
            importances = self.classifier.feature_importances_
            return dict(zip(feature_names, [float(imp) for imp in importances]))
        except:
            return {}
