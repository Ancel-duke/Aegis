import pytest
import numpy as np
from app.services.anomaly_detector import AnomalyDetector
from app.schemas.inference import SeverityLevel, RemediationAction


class TestAnomalyDetector:
    """Test suite for anomaly detection"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.detector = AnomalyDetector(contamination=0.1)
    
    def test_initialization(self):
        """Test detector initialization"""
        assert self.detector.contamination == 0.1
        assert not self.detector.is_trained
    
    def test_training(self):
        """Test model training"""
        # Generate synthetic normal data
        X_train = np.random.randn(100, 5)
        
        self.detector.train(X_train)
        
        assert self.detector.is_trained
    
    def test_prediction_untrained(self):
        """Test prediction on untrained model"""
        X_test = np.random.randn(1, 5)
        
        is_anomaly, score, severity, action, details = self.detector.predict(X_test)
        
        assert not is_anomaly
        assert score == 0.0
        assert severity == SeverityLevel.LOW
        assert action == RemediationAction.NO_ACTION
    
    def test_normal_data_prediction(self):
        """Test prediction on normal data"""
        # Train on normal data
        X_train = np.random.randn(100, 5)
        self.detector.train(X_train)
        
        # Test on similar normal data
        X_test = np.random.randn(1, 5)
        
        is_anomaly, score, severity, action, details = self.detector.predict(X_test)
        
        # Should detect as normal (not anomalous)
        assert score < 0.7  # Low anomaly score for normal data
    
    def test_anomalous_data_prediction(self):
        """Test prediction on anomalous data"""
        # Train on normal data (mean=0, std=1)
        X_train = np.random.randn(100, 5)
        self.detector.train(X_train)
        
        # Test on clearly anomalous data (mean=10, std=1)
        X_test = np.random.randn(1, 5) + 10
        
        is_anomaly, score, severity, action, details = self.detector.predict(X_test)
        
        # Should detect as anomaly
        assert is_anomaly
        assert score > 0.5  # High anomaly score
        assert severity in [SeverityLevel.MEDIUM, SeverityLevel.HIGH, SeverityLevel.CRITICAL]
    
    def test_severity_determination(self):
        """Test severity level determination"""
        assert self.detector._determine_severity(0.95) == SeverityLevel.CRITICAL
        assert self.detector._determine_severity(0.75) == SeverityLevel.HIGH
        assert self.detector._determine_severity(0.55) == SeverityLevel.MEDIUM
        assert self.detector._determine_severity(0.30) == SeverityLevel.LOW
    
    def test_score_normalization(self):
        """Test anomaly score normalization"""
        # Test various scores
        assert 0.0 <= self.detector._normalize_score(-0.5) <= 1.0
        assert 0.0 <= self.detector._normalize_score(-0.2) <= 1.0
        assert 0.0 <= self.detector._normalize_score(0.0) <= 1.0
    
    def test_feature_importance(self):
        """Test affected features identification"""
        X = np.array([[1.0, 50.0, 0.5, 100.0, 2.0]])
        feature_names = ['cpu', 'memory', 'disk', 'network', 'errors']
        
        affected = self.detector._get_affected_features(X, feature_names)
        
        assert len(affected) > 0
        assert 'network' in affected  # Should identify high values
        assert 'memory' in affected
    
    def test_action_recommendation(self):
        """Test remediation action recommendations"""
        # High CPU scenario
        X_cpu = np.array([[90, 50, 10, 0]])
        feature_names_cpu = ['cpu_usage_mean', 'memory_usage_mean', 'request_rate_mean', 'error_rate_mean']
        
        action = self.detector._recommend_action(0.8, X_cpu, feature_names_cpu)
        
        assert action == RemediationAction.SCALE_UP
        
        # High error rate scenario
        X_error = np.array([[50, 50, 100, 50]])
        feature_names_error = ['cpu_usage_mean', 'memory_usage_mean', 'request_rate_mean', 'error_rate_mean']
        
        action = self.detector._recommend_action(0.8, X_error, feature_names_error)
        
        assert action in [RemediationAction.RESTART_POD, RemediationAction.ALERT_ADMIN]
    
    def test_multiple_samples(self):
        """Test with multiple training samples"""
        # Train with more samples
        X_train = np.random.randn(500, 10)
        self.detector.train(X_train)
        
        # Test predictions
        X_test_normal = np.random.randn(1, 10)
        X_test_anomaly = np.random.randn(1, 10) + 5
        
        is_anomaly_normal, score_normal, _, _, _ = self.detector.predict(X_test_normal)
        is_anomaly_high, score_high, _, _, _ = self.detector.predict(X_test_anomaly)
        
        # Anomalous data should have higher score
        assert score_high > score_normal
    
    def test_insufficient_training_data(self):
        """Test behavior with insufficient training data"""
        X_train_small = np.random.randn(5, 3)  # Too few samples
        
        self.detector.train(X_train_small)
        
        # Should handle gracefully
        assert not self.detector.is_trained
