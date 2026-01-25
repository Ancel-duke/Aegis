import numpy as np
from typing import List
import logging

from app.services.anomaly_detector import AnomalyDetector
from app.services.failure_detector import FailureDetector
from app.services.preprocessing import DataPreprocessor
from app.schemas.inference import (
    MetricData,
    LogData,
    AnomalyDetectionResponse,
    FailureDetectionResponse,
    SeverityLevel,
    RemediationAction
)
from app.config import settings

logger = logging.getLogger(__name__)


class ModelService:
    """Service for managing ML models"""
    
    def __init__(self):
        self.anomaly_detector = AnomalyDetector(
            contamination=1 - settings.anomaly_threshold
        )
        self.failure_detector = FailureDetector()
        self.preprocessor = DataPreprocessor()
        self.models_loaded = False
    
    async def load_models(self):
        """Load and initialize models"""
        try:
            logger.info("Loading ML models...")
            
            # In production, load pre-trained models from disk
            # For now, we'll use untrained models that will use heuristics
            
            # Generate some synthetic training data for demonstration
            X_train_anomaly = np.random.randn(100, 10)
            self.anomaly_detector.train(X_train_anomaly)
            
            logger.info("Models loaded successfully")
            self.models_loaded = True
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            self.models_loaded = False
    
    async def detect_anomaly(
        self,
        metrics: List[MetricData]
    ) -> AnomalyDetectionResponse:
        """
        Detect anomalies in metrics
        
        Args:
            metrics: List of metric data points
            
        Returns:
            AnomalyDetectionResponse
        """
        try:
            # Preprocess metrics
            features, feature_names = self.preprocessor.preprocess_metrics(metrics)
            
            if features.size == 0:
                return AnomalyDetectionResponse(
                    is_anomaly=False,
                    anomaly_score=0.0,
                    severity=SeverityLevel.LOW,
                    recommended_action=RemediationAction.NO_ACTION,
                    confidence=0.0,
                    affected_metrics=[],
                    details={"error": "No features extracted"}
                )
            
            # Detect anomaly
            is_anomaly, score, severity, action, details = self.anomaly_detector.predict(
                features,
                feature_names
            )
            
            # Extract affected metric types
            affected_metrics = [m.metric_type.value for m in metrics]
            
            return AnomalyDetectionResponse(
                is_anomaly=is_anomaly,
                anomaly_score=score,
                severity=severity,
                recommended_action=action,
                confidence=details.get('model_confidence', 0.0),
                affected_metrics=list(set(affected_metrics)),
                details=details
            )
            
        except Exception as e:
            logger.error(f"Error in anomaly detection: {e}")
            return AnomalyDetectionResponse(
                is_anomaly=False,
                anomaly_score=0.0,
                severity=SeverityLevel.LOW,
                recommended_action=RemediationAction.NO_ACTION,
                confidence=0.0,
                affected_metrics=[],
                details={"error": str(e)}
            )
    
    async def detect_failure(
        self,
        metrics: List[MetricData],
        logs: List[LogData]
    ) -> FailureDetectionResponse:
        """
        Detect failure patterns
        
        Args:
            metrics: List of metric data points
            logs: List of log entries
            
        Returns:
            FailureDetectionResponse
        """
        try:
            # Preprocess metrics and logs
            metric_features, metric_names = self.preprocessor.preprocess_metrics(metrics)
            log_features, log_names = self.preprocessor.preprocess_logs(logs, settings.failure_detection_window)
            
            # Combine features
            features = self.preprocessor.combine_features(metric_features, log_features)
            feature_names = metric_names + log_names
            
            if features.size == 0:
                return FailureDetectionResponse(
                    failure_detected=False,
                    failure_type=None,
                    severity=SeverityLevel.LOW,
                    recommended_actions=[RemediationAction.NO_ACTION],
                    confidence=0.0,
                    root_cause=None,
                    affected_services=[],
                    details={"error": "No features extracted"}
                )
            
            # Detect failure
            (
                failure_detected,
                failure_type,
                severity,
                actions,
                confidence,
                root_cause,
                affected_services,
                details
            ) = self.failure_detector.predict(features, feature_names)
            
            return FailureDetectionResponse(
                failure_detected=failure_detected,
                failure_type=failure_type,
                severity=severity,
                recommended_actions=actions,
                confidence=confidence,
                root_cause=root_cause,
                affected_services=affected_services,
                details=details
            )
            
        except Exception as e:
            logger.error(f"Error in failure detection: {e}")
            return FailureDetectionResponse(
                failure_detected=False,
                failure_type=None,
                severity=SeverityLevel.LOW,
                recommended_actions=[RemediationAction.NO_ACTION],
                confidence=0.0,
                root_cause=None,
                affected_services=[],
                details={"error": str(e)}
            )
