import pytest
from datetime import datetime
from app.schemas.inference import MetricData, LogData, MetricType


@pytest.fixture
def sample_metrics():
    """Fixture providing sample metrics"""
    now = datetime.utcnow()
    return [
        MetricData(
            metric_type=MetricType.CPU_USAGE,
            value=75.5,
            timestamp=now,
            labels={'pod': 'api-1', 'namespace': 'default'}
        ),
        MetricData(
            metric_type=MetricType.MEMORY_USAGE,
            value=82.3,
            timestamp=now,
            labels={'pod': 'api-1', 'namespace': 'default'}
        ),
        MetricData(
            metric_type=MetricType.REQUEST_RATE,
            value=150.0,
            timestamp=now,
            labels={'pod': 'api-1', 'namespace': 'default'}
        )
    ]


@pytest.fixture
def sample_logs():
    """Fixture providing sample logs"""
    now = datetime.utcnow()
    return [
        LogData(
            timestamp=now,
            level='error',
            message='Connection timeout',
            service='api-service',
            metadata={'pod': 'api-1'}
        ),
        LogData(
            timestamp=now,
            level='warn',
            message='High memory usage detected',
            service='api-service',
            metadata={'pod': 'api-1'}
        ),
        LogData(
            timestamp=now,
            level='error',
            message='Failed to connect to database',
            service='api-service',
            metadata={'pod': 'api-1'}
        )
    ]
