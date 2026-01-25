import pytest
import numpy as np
from datetime import datetime, timedelta
from app.services.preprocessing import DataPreprocessor
from app.schemas.inference import MetricData, LogData, MetricType


class TestDataPreprocessor:
    """Test suite for data preprocessing"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.preprocessor = DataPreprocessor()
    
    def test_initialization(self):
        """Test preprocessor initialization"""
        assert self.preprocessor.scaler is not None
        assert isinstance(self.preprocessor.feature_names, list)
    
    def test_preprocess_empty_metrics(self):
        """Test preprocessing with empty metrics"""
        features, feature_names = self.preprocessor.preprocess_metrics([])
        
        assert features.size == 0
        assert len(feature_names) == 0
    
    def test_preprocess_single_metric(self):
        """Test preprocessing with single metric"""
        now = datetime.utcnow()
        metrics = [
            MetricData(
                metric_type=MetricType.CPU_USAGE,
                value=75.5,
                timestamp=now,
                labels={'pod': 'api-1'}
            )
        ]
        
        features, feature_names = self.preprocessor.preprocess_metrics(metrics)
        
        assert features.shape[0] == 1  # One sample
        assert len(feature_names) > 0
        assert any('cpu_usage' in name for name in feature_names)
    
    def test_preprocess_multiple_metrics(self):
        """Test preprocessing with multiple metrics"""
        now = datetime.utcnow()
        metrics = []
        
        for i in range(10):
            metrics.append(MetricData(
                metric_type=MetricType.CPU_USAGE,
                value=50.0 + i * 2,
                timestamp=now - timedelta(seconds=i*10),
                labels={'pod': 'api-1'}
            ))
            metrics.append(MetricData(
                metric_type=MetricType.MEMORY_USAGE,
                value=60.0 + i,
                timestamp=now - timedelta(seconds=i*10),
                labels={'pod': 'api-1'}
            ))
        
        features, feature_names = self.preprocessor.preprocess_metrics(metrics)
        
        assert features.shape[0] == 1
        assert len(feature_names) > 0
        
        # Should have features for both metric types
        assert any('cpu_usage' in name for name in feature_names)
        assert any('memory_usage' in name for name in feature_names)
        
        # Should have statistical features
        assert any('_mean' in name for name in feature_names)
        assert any('_std' in name for name in feature_names)
        assert any('_trend' in name for name in feature_names)
    
    def test_statistical_features(self):
        """Test generation of statistical features"""
        now = datetime.utcnow()
        values = [10, 20, 30, 40, 50]
        
        metrics = [
            MetricData(
                metric_type=MetricType.REQUEST_RATE,
                value=v,
                timestamp=now - timedelta(seconds=i*10),
                labels={}
            )
            for i, v in enumerate(values)
        ]
        
        features, feature_names = self.preprocessor.preprocess_metrics(metrics)
        
        # Extract feature dict for verification
        feature_dict = dict(zip(feature_names, features[0]))
        
        # Verify statistical measures
        assert 'request_rate_mean' in feature_dict
        assert 'request_rate_std' in feature_dict
        assert 'request_rate_min' in feature_dict
        assert 'request_rate_max' in feature_dict
        
        assert feature_dict['request_rate_mean'] == pytest.approx(30.0, rel=0.1)
        assert feature_dict['request_rate_min'] == pytest.approx(10.0, rel=0.1)
        assert feature_dict['request_rate_max'] == pytest.approx(50.0, rel=0.1)
    
    def test_preprocess_empty_logs(self):
        """Test preprocessing with empty logs"""
        features, feature_names = self.preprocessor.preprocess_logs([])
        
        assert features.size == 0
        assert len(feature_names) == 0
    
    def test_preprocess_logs(self):
        """Test log preprocessing"""
        now = datetime.utcnow()
        logs = [
            LogData(
                timestamp=now - timedelta(seconds=10),
                level='error',
                message='Connection timeout',
                service='api'
            ),
            LogData(
                timestamp=now - timedelta(seconds=20),
                level='error',
                message='Failed to connect to database',
                service='api'
            ),
            LogData(
                timestamp=now - timedelta(seconds=30),
                level='warn',
                message='High memory usage',
                service='worker'
            ),
            LogData(
                timestamp=now - timedelta(seconds=40),
                level='info',
                message='Request completed',
                service='api'
            )
        ]
        
        features, feature_names = self.preprocessor.preprocess_logs(logs)
        
        assert features.shape[0] == 1
        assert len(feature_names) > 0
        
        # Should have log count features
        assert 'error_count' in feature_names
        assert 'warn_count' in feature_names
        assert 'error_rate' in feature_names
        
        # Verify counts
        feature_dict = dict(zip(feature_names, features[0]))
        assert feature_dict['error_count'] == 2
        assert feature_dict['warn_count'] == 1
    
    def test_keyword_extraction(self):
        """Test extraction of error keywords from logs"""
        now = datetime.utcnow()
        logs = [
            LogData(
                timestamp=now,
                level='error',
                message='Connection timeout occurred',
                service='api'
            ),
            LogData(
                timestamp=now,
                level='error',
                message='Connection failed',
                service='api'
            ),
            LogData(
                timestamp=now,
                level='error',
                message='Exception in handler',
                service='api'
            )
        ]
        
        features, feature_names = self.preprocessor.preprocess_logs(logs)
        feature_dict = dict(zip(feature_names, features[0]))
        
        # Should detect keywords
        assert 'keyword_timeout' in feature_names
        assert 'keyword_connection' in feature_names
        assert 'keyword_exception' in feature_names
        
        assert feature_dict['keyword_timeout'] >= 1
        assert feature_dict['keyword_connection'] >= 2
        assert feature_dict['keyword_exception'] >= 1
    
    def test_combine_features(self):
        """Test feature combination"""
        metric_features = np.array([[1, 2, 3, 4, 5]])
        log_features = np.array([[6, 7, 8]])
        
        combined = self.preprocessor.combine_features(metric_features, log_features)
        
        assert combined.shape == (1, 8)
        assert np.array_equal(combined[0], [1, 2, 3, 4, 5, 6, 7, 8])
    
    def test_combine_empty_features(self):
        """Test combining when one feature set is empty"""
        metric_features = np.array([[1, 2, 3]])
        log_features = np.array([])
        
        combined = self.preprocessor.combine_features(metric_features, log_features)
        
        assert np.array_equal(combined, metric_features)
    
    def test_normalize_features(self):
        """Test feature normalization"""
        features = np.array([[10, 100, 1000], [20, 200, 2000]])
        
        normalized = self.preprocessor.normalize_features(features)
        
        # Normalized features should have mean ~0 and std ~1
        assert normalized.shape == features.shape
        assert np.abs(np.mean(normalized, axis=0)).max() < 1.0
    
    def test_nan_handling(self):
        """Test handling of NaN and infinite values"""
        now = datetime.utcnow()
        metrics = [
            MetricData(
                metric_type=MetricType.CPU_USAGE,
                value=float('inf'),  # Infinite value
                timestamp=now,
                labels={}
            )
        ]
        
        features, feature_names = self.preprocessor.preprocess_metrics(metrics)
        
        # Should not contain NaN or inf
        assert not np.isnan(features).any()
        assert not np.isinf(features).any()
