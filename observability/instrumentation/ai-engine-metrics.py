"""
AI Engine - Prometheus Metrics & OpenTelemetry Instrumentation

NOTE: This is example/reference code to be integrated into your AI Engine service.
Install dependencies: pip install prometheus-client opentelemetry-api opentelemetry-sdk
"""

from prometheus_client import Counter, Histogram, Gauge, generate_latest, REGISTRY, CollectorRegistry  # type: ignore
from opentelemetry import trace, metrics  # type: ignore
from opentelemetry.sdk.trace import TracerProvider  # type: ignore
from opentelemetry.sdk.trace.export import BatchSpanProcessor  # type: ignore
from opentelemetry.sdk.metrics import MeterProvider  # type: ignore
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader  # type: ignore
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter  # type: ignore
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter  # type: ignore
from opentelemetry.sdk.resources import Resource  # type: ignore
from opentelemetry.semconv.resource import ResourceAttributes  # type: ignore
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentation  # type: ignore
from opentelemetry.instrumentation.requests import RequestsInstrumentation  # type: ignore
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentation  # type: ignore
import time
from functools import wraps
from typing import Optional, Callable, Any
import os

# =====================================================
# OpenTelemetry Setup
# =====================================================

def initialize_opentelemetry(app=None):
    """Initialize OpenTelemetry with OTLP exporters"""
    
    # Resource attributes
    resource = Resource(attributes={
        ResourceAttributes.SERVICE_NAME: "aegis-ai-engine",
        ResourceAttributes.SERVICE_VERSION: "1.0.0",
        ResourceAttributes.DEPLOYMENT_ENVIRONMENT: os.getenv('ENVIRONMENT', 'development'),
    })
    
    # Tracing
    trace_provider = TracerProvider(resource=resource)
    otlp_trace_exporter = OTLPSpanExporter(
        endpoint=os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318/v1/traces')
    )
    trace_provider.add_span_processor(BatchSpanProcessor(otlp_trace_exporter))
    trace.set_tracer_provider(trace_provider)
    
    # Metrics
    otlp_metric_exporter = OTLPMetricExporter(
        endpoint=os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318/v1/metrics')
    )
    metric_reader = PeriodicExportingMetricReader(
        otlp_metric_exporter,
        export_interval_millis=10000
    )
    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)
    
    # Auto-instrumentation
    if app:
        FastAPIInstrumentation().instrument_app(app)
    RequestsInstrumentation().instrument()
    # SQLAlchemyInstrumentation().instrument(engine=engine)  # Uncomment with your engine
    
    return trace.get_tracer(__name__), metrics.get_meter(__name__)


# =====================================================
# Prometheus Metrics
# =====================================================

class AIEngineMetrics:
    """Prometheus metrics for AI Engine"""
    
    def __init__(self):
        # Model inference metrics
        self.ai_predictions_total = Counter(
            'ai_predictions_total',
            'Total number of AI predictions',
            ['model_type', 'status']  # status: success, error
        )
        
        self.ai_inference_duration = Histogram(
            'ai_inference_duration_seconds',
            'AI inference duration in seconds',
            ['model_type'],
            buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
        )
        
        self.ai_anomalies_detected = Counter(
            'ai_anomalies_detected_total',
            'Total anomalies detected',
            ['severity']  # low, medium, high, critical
        )
        
        self.ai_failures_detected = Counter(
            'ai_failures_detected_total',
            'Total failures detected',
            ['failure_type']
        )
        
        # Model performance metrics
        self.ai_model_confidence = Histogram(
            'ai_model_confidence_score',
            'Model confidence score distribution',
            ['model_type'],
            buckets=[0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99]
        )
        
        self.ai_model_accuracy = Gauge(
            'ai_model_accuracy',
            'Model accuracy score',
            ['model_type']
        )
        
        # Data processing metrics
        self.ai_features_processed = Counter(
            'ai_features_processed_total',
            'Total features processed',
            ['feature_type']
        )
        
        self.ai_preprocessing_duration = Histogram(
            'ai_preprocessing_duration_seconds',
            'Data preprocessing duration',
            ['pipeline_stage'],
            buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5]
        )
        
        # Model training metrics
        self.ai_model_training_duration = Histogram(
            'ai_model_training_duration_seconds',
            'Model training duration',
            ['model_type'],
            buckets=[1, 5, 10, 30, 60, 300, 600]
        )
        
        self.ai_training_samples = Counter(
            'ai_training_samples_total',
            'Total training samples processed',
            ['model_type']
        )
        
        # System metrics
        self.ai_active_models = Gauge(
            'ai_active_models',
            'Number of active loaded models'
        )
        
        self.ai_model_memory_bytes = Gauge(
            'ai_model_memory_bytes',
            'Memory used by models in bytes',
            ['model_type']
        )
        
        # External integration metrics
        self.ai_policy_engine_requests = Counter(
            'ai_policy_engine_requests_total',
            'Total requests to Policy Engine',
            ['status']
        )
        
        self.ai_executor_triggers = Counter(
            'ai_executor_triggers_total',
            'Total executor action triggers',
            ['action_type', 'status']
        )
    
    def get_metrics(self) -> bytes:
        """Get metrics in Prometheus format"""
        return generate_latest(REGISTRY)
    
    def track_prediction(
        self,
        model_type: str,
        duration: float,
        success: bool,
        confidence: Optional[float] = None
    ):
        """Track a model prediction"""
        status = 'success' if success else 'error'
        self.ai_predictions_total.labels(model_type=model_type, status=status).inc()
        self.ai_inference_duration.labels(model_type=model_type).observe(duration)
        
        if confidence is not None:
            self.ai_model_confidence.labels(model_type=model_type).observe(confidence)
    
    def track_anomaly(self, severity: str):
        """Track anomaly detection"""
        self.ai_anomalies_detected.labels(severity=severity).inc()
    
    def track_failure(self, failure_type: str):
        """Track failure detection"""
        self.ai_failures_detected.labels(failure_type=failure_type).inc()
    
    def track_preprocessing(self, stage: str, duration: float):
        """Track preprocessing step"""
        self.ai_preprocessing_duration.labels(pipeline_stage=stage).observe(duration)
    
    def track_training(self, model_type: str, duration: float, sample_count: int):
        """Track model training"""
        self.ai_model_training_duration.labels(model_type=model_type).observe(duration)
        self.ai_training_samples.labels(model_type=model_type).inc(sample_count)


# Global metrics instance
metrics_service = AIEngineMetrics()


# =====================================================
# OpenTelemetry Tracing Decorators
# =====================================================

def trace_function(name: Optional[str] = None, attributes: Optional[dict] = None):
    """Decorator to trace function execution"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            tracer = trace.get_tracer(__name__)
            span_name = name or f"{func.__module__}.{func.__name__}"
            
            with tracer.start_as_current_span(span_name) as span:
                if attributes:
                    for key, value in attributes.items():
                        span.set_attribute(key, value)
                
                try:
                    result = await func(*args, **kwargs)
                    span.set_status(trace.StatusCode.OK)
                    return result
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(trace.StatusCode.ERROR, str(e))
                    raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            tracer = trace.get_tracer(__name__)
            span_name = name or f"{func.__module__}.{func.__name__}"
            
            with tracer.start_as_current_span(span_name) as span:
                if attributes:
                    for key, value in attributes.items():
                        span.set_attribute(key, value)
                
                try:
                    result = func(*args, **kwargs)
                    span.set_status(trace.StatusCode.OK)
                    return result
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(trace.StatusCode.ERROR, str(e))
                    raise
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


def measure_time(metric: Histogram, labels: dict):
    """Decorator to measure function execution time"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.time()
            try:
                return await func(*args, **kwargs)
            finally:
                duration = time.time() - start
                metric.labels(**labels).observe(duration)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.time()
            try:
                return func(*args, **kwargs)
            finally:
                duration = time.time() - start
                metric.labels(**labels).observe(duration)
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


# =====================================================
# FastAPI Integration
# =====================================================

from fastapi import FastAPI, Response

def setup_metrics_endpoint(app: FastAPI):
    """Add metrics endpoint to FastAPI app"""
    
    @app.get("/metrics")
    async def metrics_endpoint():
        """Prometheus metrics endpoint"""
        return Response(
            content=metrics_service.get_metrics(),
            media_type="text/plain"
        )


# =====================================================
# Usage Examples
# =====================================================

"""
# In main.py
from app.metrics.ai_engine_metrics import (
    initialize_opentelemetry,
    setup_metrics_endpoint,
    metrics_service
)

app = FastAPI()

# Initialize OpenTelemetry
tracer, meter = initialize_opentelemetry(app)

# Add metrics endpoint
setup_metrics_endpoint(app)

# In a service
from app.metrics.ai_engine_metrics import (
    metrics_service,
    trace_function,
    measure_time
)

class AnomalyDetector:
    @trace_function(
        name="anomaly_detection.detect",
        attributes={"model_type": "isolation_forest"}
    )
    @measure_time(
        metric=metrics_service.ai_inference_duration,
        labels={"model_type": "anomaly"}
    )
    async def detect_anomaly(self, data):
        start = time.time()
        
        try:
            # Preprocessing
            preprocessed = await self.preprocess(data)
            
            # Prediction
            result = self.model.predict(preprocessed)
            confidence = self.model.score_samples(preprocessed)
            
            # Track metrics
            duration = time.time() - start
            metrics_service.track_prediction(
                model_type='anomaly',
                duration=duration,
                success=True,
                confidence=float(confidence[0])
            )
            
            if result[0] == -1:  # Anomaly detected
                metrics_service.track_anomaly(severity='high')
            
            return {
                'is_anomaly': result[0] == -1,
                'confidence': float(confidence[0]),
                'duration': duration
            }
        
        except Exception as e:
            duration = time.time() - start
            metrics_service.track_prediction(
                model_type='anomaly',
                duration=duration,
                success=False
            )
            raise
"""
