import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta
from sklearn.preprocessing import StandardScaler
import logging

from app.schemas.inference import MetricData, LogData

logger = logging.getLogger(__name__)


class DataPreprocessor:
    """Preprocess metrics and logs for ML models"""
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.feature_names = []
    
    def preprocess_metrics(
        self,
        metrics: List[MetricData],
        window_size: int = 60
    ) -> Tuple[np.ndarray, List[str]]:
        """
        Preprocess metrics for anomaly detection
        
        Args:
            metrics: List of metric data points
            window_size: Time window in seconds
            
        Returns:
            Tuple of (feature_array, feature_names)
        """
        if not metrics:
            return np.array([]), []
        
        # Convert to DataFrame
        df = pd.DataFrame([
            {
                'timestamp': m.timestamp,
                'metric_type': m.metric_type.value,
                'value': m.value,
                **m.labels
            }
            for m in metrics
        ])
        
        # Sort by timestamp
        df = df.sort_values('timestamp')
        
        features = {}
        
        # Group by metric type
        for metric_type in df['metric_type'].unique():
            metric_df = df[df['metric_type'] == metric_type]
            values = metric_df['value'].values
            
            # Statistical features
            features[f'{metric_type}_mean'] = np.mean(values)
            features[f'{metric_type}_std'] = np.std(values)
            features[f'{metric_type}_min'] = np.min(values)
            features[f'{metric_type}_max'] = np.max(values)
            features[f'{metric_type}_median'] = np.median(values)
            
            # Rate of change
            if len(values) > 1:
                features[f'{metric_type}_rate_of_change'] = (values[-1] - values[0]) / len(values)
            else:
                features[f'{metric_type}_rate_of_change'] = 0
            
            # Trend (simple linear regression slope)
            if len(values) > 2:
                x = np.arange(len(values))
                slope = np.polyfit(x, values, 1)[0]
                features[f'{metric_type}_trend'] = slope
            else:
                features[f'{metric_type}_trend'] = 0
        
        # Convert to array
        feature_names = sorted(features.keys())
        feature_array = np.array([features[name] for name in feature_names])
        
        # Handle NaN and inf values
        feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=1e10, neginf=-1e10)
        
        self.feature_names = feature_names
        
        return feature_array.reshape(1, -1), feature_names
    
    def preprocess_logs(
        self,
        logs: List[LogData],
        window_size: int = 300
    ) -> Tuple[np.ndarray, List[str]]:
        """
        Preprocess logs for failure detection
        
        Args:
            logs: List of log entries
            window_size: Time window in seconds
            
        Returns:
            Tuple of (feature_array, feature_names)
        """
        if not logs:
            return np.array([]), []
        
        # Filter recent logs
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=window_size)
        recent_logs = [log for log in logs if log.timestamp >= cutoff]
        
        if not recent_logs:
            return np.array([]), []
        
        features = {}
        
        # Count by level
        level_counts = {}
        for log in recent_logs:
            level = log.level.lower()
            level_counts[level] = level_counts.get(level, 0) + 1
        
        features['error_count'] = level_counts.get('error', 0)
        features['warn_count'] = level_counts.get('warn', 0)
        features['info_count'] = level_counts.get('info', 0)
        features['total_logs'] = len(recent_logs)
        
        # Error rate
        features['error_rate'] = features['error_count'] / features['total_logs'] if features['total_logs'] > 0 else 0
        
        # Count by service
        service_counts = {}
        for log in recent_logs:
            service = log.service
            service_counts[service] = service_counts.get(service, 0) + 1
        
        features['unique_services'] = len(service_counts)
        features['max_service_errors'] = max(service_counts.values()) if service_counts else 0
        
        # Keyword analysis (common error patterns)
        error_keywords = ['timeout', 'connection', 'failed', 'exception', 'error', 'crashed']
        keyword_counts = {kw: 0 for kw in error_keywords}
        
        for log in recent_logs:
            if log.level.lower() == 'error':
                message_lower = log.message.lower()
                for keyword in error_keywords:
                    if keyword in message_lower:
                        keyword_counts[keyword] += 1
        
        for keyword, count in keyword_counts.items():
            features[f'keyword_{keyword}'] = count
        
        # Convert to array
        feature_names = sorted(features.keys())
        feature_array = np.array([features[name] for name in feature_names])
        
        # Handle NaN and inf values
        feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=1e10, neginf=-1e10)
        
        return feature_array.reshape(1, -1), feature_names
    
    def combine_features(
        self,
        metric_features: np.ndarray,
        log_features: np.ndarray
    ) -> np.ndarray:
        """Combine metric and log features"""
        if metric_features.size == 0 and log_features.size == 0:
            return np.array([])
        
        if metric_features.size == 0:
            return log_features
        
        if log_features.size == 0:
            return metric_features
        
        return np.concatenate([metric_features, log_features], axis=1)
    
    def normalize_features(self, features: np.ndarray) -> np.ndarray:
        """Normalize features using StandardScaler"""
        if features.size == 0:
            return features
        
        # Fit and transform
        try:
            normalized = self.scaler.fit_transform(features)
            return normalized
        except Exception as e:
            logger.error(f"Error normalizing features: {e}")
            return features
