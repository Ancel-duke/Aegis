from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum


class MetricType(str, Enum):
    CPU_USAGE = "cpu_usage"
    MEMORY_USAGE = "memory_usage"
    REQUEST_RATE = "request_rate"
    ERROR_RATE = "error_rate"
    RESPONSE_TIME = "response_time"
    DISK_IO = "disk_io"


class RemediationAction(str, Enum):
    SCALE_UP = "scale_up"
    SCALE_DOWN = "scale_down"
    RESTART_POD = "restart_pod"
    THROTTLE_API = "throttle_api"
    CLEAR_CACHE = "clear_cache"
    NO_ACTION = "no_action"
    ALERT_ADMIN = "alert_admin"


class SeverityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class MetricData(BaseModel):
    """Input metric data"""
    metric_type: MetricType
    value: float
    timestamp: datetime
    labels: Dict[str, str] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LogData(BaseModel):
    """Input log data"""
    timestamp: datetime
    level: str  # error, warn, info, debug
    message: str
    service: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AnomalyDetectionRequest(BaseModel):
    """Request for anomaly detection"""
    metrics: List[MetricData]
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class FailureDetectionRequest(BaseModel):
    """Request for failure pattern detection"""
    metrics: List[MetricData]
    logs: List[LogData]
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class AnomalyDetectionResponse(BaseModel):
    """Response from anomaly detection"""
    is_anomaly: bool
    anomaly_score: float
    severity: SeverityLevel
    recommended_action: RemediationAction
    confidence: float
    affected_metrics: List[str]
    details: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class FailureDetectionResponse(BaseModel):
    """Response from failure pattern detection"""
    failure_detected: bool
    failure_type: Optional[str] = None
    severity: SeverityLevel
    recommended_actions: List[RemediationAction]
    confidence: float
    root_cause: Optional[str] = None
    affected_services: List[str]
    details: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: datetime
    uptime: float
    models_loaded: bool
    database_connected: bool
