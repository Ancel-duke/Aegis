import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.covariance import EllipticEnvelope
import logging
from typing import Tuple, Dict, Any

from app.schemas.inference import SeverityLevel, RemediationAction

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Detect anomalies in system metrics"""
    
    def __init__(self, contamination: float = 0.1):
        """
        Initialize anomaly detector
        
        Args:
            contamination: Expected proportion of outliers (0.0 to 0.5)
        """
        self.contamination = contamination
        
        # Isolation Forest for general anomaly detection
        self.isolation_forest = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100
        )
        
        # Elliptic Envelope for Gaussian distribution anomalies
        self.elliptic_envelope = EllipticEnvelope(
            contamination=contamination,
            random_state=42
        )
        
        self.is_trained = False
        self.feature_importance = {}
    
    def train(self, X: np.ndarray) -> None:
        """
        Train the anomaly detection models
        
        Args:
            X: Training data (n_samples, n_features)
        """
        if X.shape[0] < 10:
            logger.warning("Insufficient training samples for anomaly detection")
            return
        
        try:
            self.isolation_forest.fit(X)
            
            # Only use Elliptic Envelope if we have enough samples
            if X.shape[0] >= X.shape[1] + 1:
                self.elliptic_envelope.fit(X)
            
            self.is_trained = True
            logger.info(f"Anomaly detector trained with {X.shape[0]} samples")
        except Exception as e:
            logger.error(f"Error training anomaly detector: {e}")
    
    def predict(
        self,
        X: np.ndarray,
        feature_names: list = None
    ) -> Tuple[bool, float, SeverityLevel, RemediationAction, Dict[str, Any]]:
        """
        Predict if input is anomalous
        
        Args:
            X: Input features (1, n_features)
            feature_names: Names of features
            
        Returns:
            Tuple of (is_anomaly, anomaly_score, severity, action, details)
        """
        if not self.is_trained:
            logger.warning("Model not trained, using default prediction")
            return False, 0.0, SeverityLevel.LOW, RemediationAction.NO_ACTION, {}
        
        try:
            # Isolation Forest prediction
            iso_prediction = self.isolation_forest.predict(X)[0]
            iso_score = self.isolation_forest.score_samples(X)[0]
            
            # -1 means anomaly, 1 means normal
            is_anomaly_iso = iso_prediction == -1
            
            # Normalize score to 0-1 range
            anomaly_score = self._normalize_score(-iso_score)
            
            # Determine severity based on score
            severity = self._determine_severity(anomaly_score)
            
            # Recommend action based on severity and features
            action = self._recommend_action(anomaly_score, X, feature_names)
            
            # Get affected features
            affected_features = self._get_affected_features(X, feature_names)
            
            details = {
                "anomaly_score": float(anomaly_score),
                "affected_features": affected_features,
                "model_confidence": float(1.0 - abs(iso_score) / 10.0),
                "threshold_used": self.contamination
            }
            
            return is_anomaly_iso, anomaly_score, severity, action, details
            
        except Exception as e:
            logger.error(f"Error during prediction: {e}")
            return False, 0.0, SeverityLevel.LOW, RemediationAction.NO_ACTION, {"error": str(e)}
    
    def _normalize_score(self, score: float) -> float:
        """Normalize anomaly score to 0-1 range"""
        # Isolation Forest scores are typically in range [-0.5, 0]
        # More negative = more anomalous
        return min(1.0, max(0.0, (-score) * 2))
    
    def _determine_severity(self, anomaly_score: float) -> SeverityLevel:
        """Determine severity level based on anomaly score"""
        if anomaly_score >= 0.9:
            return SeverityLevel.CRITICAL
        elif anomaly_score >= 0.7:
            return SeverityLevel.HIGH
        elif anomaly_score >= 0.5:
            return SeverityLevel.MEDIUM
        else:
            return SeverityLevel.LOW
    
    def _recommend_action(
        self,
        anomaly_score: float,
        X: np.ndarray,
        feature_names: list = None
    ) -> RemediationAction:
        """Recommend remediation action based on anomaly characteristics"""
        if anomaly_score < 0.5:
            return RemediationAction.NO_ACTION
        
        if not feature_names or X.size == 0:
            return RemediationAction.ALERT_ADMIN
        
        # Simple heuristic based on feature names
        feature_dict = dict(zip(feature_names, X[0])) if feature_names else {}
        
        # Check for high CPU/memory
        cpu_features = [k for k in feature_dict.keys() if 'cpu' in k.lower()]
        memory_features = [k for k in feature_dict.keys() if 'memory' in k.lower()]
        
        if cpu_features or memory_features:
            avg_cpu = np.mean([feature_dict[k] for k in cpu_features]) if cpu_features else 0
            avg_memory = np.mean([feature_dict[k] for k in memory_features]) if memory_features else 0
            
            if avg_cpu > 80 or avg_memory > 80:
                return RemediationAction.SCALE_UP
        
        # Check for high error rate
        error_features = [k for k in feature_dict.keys() if 'error' in k.lower()]
        if error_features:
            avg_error = np.mean([feature_dict[k] for k in error_features])
            if avg_error > 10:
                return RemediationAction.RESTART_POD
        
        # Check for high request rate
        request_features = [k for k in feature_dict.keys() if 'request' in k.lower()]
        if request_features:
            avg_requests = np.mean([feature_dict[k] for k in request_features])
            if avg_requests > 1000:
                return RemediationAction.THROTTLE_API
        
        if anomaly_score >= 0.8:
            return RemediationAction.ALERT_ADMIN
        
        return RemediationAction.NO_ACTION
    
    def _get_affected_features(self, X: np.ndarray, feature_names: list = None) -> list:
        """Identify which features contribute most to the anomaly"""
        if not feature_names or X.size == 0:
            return []
        
        # Get feature values
        feature_dict = dict(zip(feature_names, X[0]))
        
        # Sort by absolute value
        sorted_features = sorted(
            feature_dict.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )
        
        # Return top contributing features
        return [name for name, _ in sorted_features[:5]]
