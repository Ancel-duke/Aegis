"""
AI Engine - Metrics Feed Integration
Fetches metrics from Prometheus for anomaly detection

NOTE: This is example/reference code to be integrated into your AI Engine service.
Install dependencies: pip install httpx
"""

import httpx  # type: ignore
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import asyncio
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class MetricQuery:
    """Prometheus metric query configuration"""
    name: str
    query: str
    step: str = '15s'
    description: str = ''


class PrometheusMetricsFeed:
    """
    Fetch metrics from Prometheus for AI Engine analysis
    """
    
    def __init__(self, prometheus_url: str = 'http://localhost:9090'):
        self.prometheus_url = prometheus_url
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def query_range(
        self,
        query: str,
        start: datetime,
        end: datetime,
        step: str = '15s'
    ) -> Dict[str, Any]:
        """
        Query Prometheus range endpoint
        
        Args:
            query: PromQL query
            start: Start time
            end: End time
            step: Query resolution
        
        Returns:
            Query results
        """
        url = f"{self.prometheus_url}/api/v1/query_range"
        params = {
            'query': query,
            'start': start.isoformat(),
            'end': end.isoformat(),
            'step': step
        }
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to query Prometheus: {e}")
            raise
    
    async def fetch_api_metrics(
        self,
        service: str,
        duration_minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Fetch API metrics for analysis
        
        Args:
            service: Service name (backend, ai-engine, executor)
            duration_minutes: Time range in minutes
        
        Returns:
            List of metric data points
        """
        end = datetime.utcnow()
        start = end - timedelta(minutes=duration_minutes)
        
        queries = [
            MetricQuery(
                name='request_rate',
                query=f'rate(http_requests_total{{service="{service}"}}[5m])',
                description='Request rate per second'
            ),
            MetricQuery(
                name='error_rate',
                query=f'rate(http_requests_total{{service="{service}",status=~"5.."}}[5m]) / rate(http_requests_total{{service="{service}"}}[5m])',
                description='Error rate percentage'
            ),
            MetricQuery(
                name='latency_p50',
                query=f'histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{{service="{service}"}}[5m]))',
                description='50th percentile latency'
            ),
            MetricQuery(
                name='latency_p95',
                query=f'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{{service="{service}"}}[5m]))',
                description='95th percentile latency'
            ),
            MetricQuery(
                name='latency_p99',
                query=f'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{{service="{service}"}}[5m]))',
                description='99th percentile latency'
            ),
        ]
        
        results = []
        for query_config in queries:
            try:
                result = await self.query_range(query_config.query, start, end, query_config.step)
                results.append({
                    'name': query_config.name,
                    'description': query_config.description,
                    'data': result.get('data', {}).get('result', [])
                })
            except Exception as e:
                logger.error(f"Failed to fetch {query_config.name}: {e}")
        
        return results
    
    async def fetch_ai_engine_metrics(
        self,
        duration_minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Fetch AI Engine specific metrics
        
        Args:
            duration_minutes: Time range in minutes
        
        Returns:
            List of metric data points
        """
        end = datetime.utcnow()
        start = end - timedelta(minutes=duration_minutes)
        
        queries = [
            MetricQuery(
                name='inference_latency',
                query='histogram_quantile(0.95, rate(ai_inference_duration_seconds_bucket[5m]))',
                description='AI inference latency P95'
            ),
            MetricQuery(
                name='anomaly_rate',
                query='rate(ai_anomalies_detected_total[5m])',
                description='Anomalies detected per second'
            ),
            MetricQuery(
                name='model_error_rate',
                query='rate(ai_predictions_total{status="error"}[5m]) / rate(ai_predictions_total[5m])',
                description='Model prediction error rate'
            ),
            MetricQuery(
                name='model_confidence',
                query='histogram_quantile(0.50, rate(ai_model_confidence_score_bucket[5m]))',
                description='Model confidence median'
            ),
        ]
        
        results = []
        for query_config in queries:
            try:
                result = await self.query_range(query_config.query, start, end, query_config.step)
                results.append({
                    'name': query_config.name,
                    'description': query_config.description,
                    'data': result.get('data', {}).get('result', [])
                })
            except Exception as e:
                logger.error(f"Failed to fetch {query_config.name}: {e}")
        
        return results
    
    async def fetch_executor_metrics(
        self,
        duration_minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Fetch Executor service metrics
        
        Args:
            duration_minutes: Time range in minutes
        
        Returns:
            List of metric data points
        """
        end = datetime.utcnow()
        start = end - timedelta(minutes=duration_minutes)
        
        queries = [
            MetricQuery(
                name='action_rate',
                query='rate(executor_actions_total[5m])',
                description='Actions executed per second'
            ),
            MetricQuery(
                name='action_failure_rate',
                query='rate(executor_actions_total{status="failed"}[5m]) / rate(executor_actions_total[5m])',
                description='Action failure rate'
            ),
            MetricQuery(
                name='action_duration',
                query='histogram_quantile(0.95, rate(executor_action_duration_seconds_bucket[5m]))',
                description='Action duration P95'
            ),
        ]
        
        results = []
        for query_config in queries:
            try:
                result = await self.query_range(query_config.query, start, end, query_config.step)
                results.append({
                    'name': query_config.name,
                    'description': query_config.description,
                    'data': result.get('data', {}).get('result', [])
                })
            except Exception as e:
                logger.error(f"Failed to fetch {query_config.name}: {e}")
        
        return results
    
    async def fetch_infrastructure_metrics(
        self,
        duration_minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Fetch infrastructure metrics (CPU, memory, disk)
        
        Args:
            duration_minutes: Time range in minutes
        
        Returns:
            List of metric data points
        """
        end = datetime.utcnow()
        start = end - timedelta(minutes=duration_minutes)
        
        queries = [
            MetricQuery(
                name='cpu_usage',
                query='100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
                description='CPU usage percentage'
            ),
            MetricQuery(
                name='memory_usage',
                query='((node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes) * 100',
                description='Memory usage percentage'
            ),
            MetricQuery(
                name='disk_usage',
                query='(node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100',
                description='Disk usage percentage'
            ),
            MetricQuery(
                name='db_connections',
                query='pg_stat_activity_count',
                description='Active database connections'
            ),
            MetricQuery(
                name='redis_memory',
                query='(redis_memory_used_bytes / redis_memory_max_bytes) * 100',
                description='Redis memory usage percentage'
            ),
        ]
        
        results = []
        for query_config in queries:
            try:
                result = await self.query_range(query_config.query, start, end, query_config.step)
                results.append({
                    'name': query_config.name,
                    'description': query_config.description,
                    'data': result.get('data', {}).get('result', [])
                })
            except Exception as e:
                logger.error(f"Failed to fetch {query_config.name}: {e}")
        
        return results
    
    def transform_for_anomaly_detection(
        self,
        metrics: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Transform Prometheus metrics into format suitable for AI Engine
        
        Args:
            metrics: Raw Prometheus metrics
        
        Returns:
            Transformed metrics for anomaly detection
        """
        transformed = []
        
        for metric in metrics:
            name = metric['name']
            data = metric['data']
            
            for series in data:
                metric_labels = series.get('metric', {})
                values = series.get('values', [])
                
                for timestamp, value in values:
                    try:
                        transformed.append({
                            'metric_type': name,
                            'value': float(value),
                            'timestamp': datetime.fromtimestamp(timestamp).isoformat() + 'Z',
                            'labels': metric_labels
                        })
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Failed to transform value: {value}, error: {e}")
                        continue
        
        return transformed
    
    async def get_metrics_for_anomaly_detection(
        self,
        duration_minutes: int = 60
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get all metrics formatted for AI Engine anomaly detection
        
        Args:
            duration_minutes: Time range in minutes
        
        Returns:
            Dictionary of transformed metrics by category
        """
        # Fetch all metrics concurrently
        api_metrics, ai_metrics, executor_metrics, infra_metrics = await asyncio.gather(
            self.fetch_api_metrics('backend', duration_minutes),
            self.fetch_ai_engine_metrics(duration_minutes),
            self.fetch_executor_metrics(duration_minutes),
            self.fetch_infrastructure_metrics(duration_minutes)
        )
        
        return {
            'api': self.transform_for_anomaly_detection(api_metrics),
            'ai_engine': self.transform_for_anomaly_detection(ai_metrics),
            'executor': self.transform_for_anomaly_detection(executor_metrics),
            'infrastructure': self.transform_for_anomaly_detection(infra_metrics),
        }
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# =====================================================
# Usage Example
# =====================================================

async def example_usage():
    """Example of fetching metrics for AI analysis"""
    
    feed = PrometheusMetricsFeed('http://localhost:9090')
    
    try:
        # Fetch metrics for last hour
        metrics = await feed.get_metrics_for_anomaly_detection(duration_minutes=60)
        
        print(f"Fetched {len(metrics['api'])} API metrics")
        print(f"Fetched {len(metrics['ai_engine'])} AI Engine metrics")
        print(f"Fetched {len(metrics['executor'])} Executor metrics")
        print(f"Fetched {len(metrics['infrastructure'])} Infrastructure metrics")
        
        # Send to AI Engine for analysis
        # (This would integrate with your existing AI Engine endpoints)
        # result = await ai_engine_client.detect_anomaly(metrics=metrics['api'])
        
    finally:
        await feed.close()


if __name__ == "__main__":
    asyncio.run(example_usage())
