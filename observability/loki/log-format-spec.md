# Aegis Loki Log Format Specification

## Overview

This document specifies the log format and structure for all Aegis services to ensure consistent logging and effective observability.

## Log Format

All services should emit logs in **JSON format** with the following structure:

```json
{
  "timestamp": "2024-01-25T10:30:45.123Z",
  "level": "info",
  "service": "aegis-backend",
  "message": "User login successful",
  "trace_id": "a1b2c3d4e5f6",
  "span_id": "x1y2z3",
  "user_id": "uuid-here",
  "method": "POST",
  "path": "/api/v1/auth/login",
  "status_code": 200,
  "duration_ms": 123,
  "metadata": {
    "additional": "context"
  }
}
```

## Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `timestamp` | string | ISO 8601 timestamp | `2024-01-25T10:30:45.123Z` |
| `level` | string | Log level | `debug`, `info`, `warn`, `error`, `fatal` |
| `service` | string | Service name | `aegis-backend`, `aegis-ai-engine`, `aegis-executor` |
| `message` | string | Human-readable message | `User login successful` |

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `trace_id` | string | OpenTelemetry trace ID |
| `span_id` | string | OpenTelemetry span ID |
| `user_id` | string | User identifier |
| `method` | string | HTTP method |
| `path` | string | HTTP path |
| `status_code` | number | HTTP status code |
| `duration_ms` | number | Operation duration in milliseconds |
| `error` | object | Error details |
| `metadata` | object | Additional context |

## Log Levels

### debug
Detailed diagnostic information for development.
```json
{
  "level": "debug",
  "message": "Cache hit for key: user:123"
}
```

### info
General informational messages.
```json
{
  "level": "info",
  "message": "User login successful",
  "user_id": "123"
}
```

### warn
Warning messages for potentially harmful situations.
```json
{
  "level": "warn",
  "message": "Rate limit approaching threshold",
  "current": 95,
  "limit": 100
}
```

### error
Error events that might still allow the application to continue.
```json
{
  "level": "error",
  "message": "Failed to connect to database",
  "error": {
    "type": "ConnectionError",
    "message": "Connection timeout",
    "stack": "..."
  }
}
```

### fatal
Very severe error events that will likely cause the application to abort.
```json
{
  "level": "fatal",
  "message": "Out of memory",
  "error": {
    "type": "OutOfMemoryError",
    "message": "..."
  }
}
```

## Service-Specific Fields

### Backend (API)

```json
{
  "service": "aegis-backend",
  "level": "info",
  "message": "API request processed",
  "method": "POST",
  "path": "/api/v1/users",
  "status_code": 201,
  "duration_ms": 45,
  "user_id": "uuid",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "metadata": {
    "endpoint": "createUser",
    "controller": "UserController"
  }
}
```

### AI Engine

```json
{
  "service": "aegis-ai-engine",
  "level": "info",
  "message": "Anomaly detection completed",
  "model_type": "isolation_forest",
  "duration_ms": 234,
  "is_anomaly": true,
  "confidence": 0.92,
  "severity": "high",
  "affected_metrics": ["cpu_usage", "memory_usage"],
  "metadata": {
    "model_version": "1.2.0",
    "features_count": 15
  }
}
```

### Executor

```json
{
  "service": "aegis-executor",
  "level": "info",
  "message": "Action executed successfully",
  "action_type": "restart_pod",
  "namespace": "production",
  "resource_type": "pod",
  "resource_name": "api-pod-123",
  "status": "completed",
  "duration_ms": 1234,
  "requested_by": "ai-engine",
  "metadata": {
    "audit_id": "uuid",
    "policy_decision": "approved"
  }
}
```

## Loki Labels

Logs should be labeled for efficient querying:

```yaml
# Backend
job: aegis-backend
level: info
service: backend
component: api

# AI Engine
job: aegis-ai-engine
level: info
service: ai-engine
component: ml
model_type: anomaly

# Executor
job: aegis-executor
level: info
service: executor
component: k8s
namespace: production
```

## Log Queries

### Recent Errors
```logql
{job="aegis-backend"} |= "error" | json | level="error"
```

### API Latency
```logql
{job="aegis-backend"} | json | duration_ms > 1000
```

### Anomalies Detected
```logql
{job="aegis-ai-engine"} | json | is_anomaly="true"
```

### Failed Actions
```logql
{job="aegis-executor"} | json | status="failed"
```

### User Activity
```logql
{job="aegis-backend"} | json | user_id="uuid-here"
```

## Error Format

Errors should include:

```json
{
  "level": "error",
  "message": "Operation failed",
  "error": {
    "type": "ValidationError",
    "message": "Invalid email format",
    "code": "VALIDATION_001",
    "field": "email",
    "stack": "Error: Invalid email format\n    at ...",
    "context": {
      "email": "invalid-email"
    }
  }
}
```

## Audit Log Format

For security-critical operations:

```json
{
  "level": "info",
  "message": "Security audit log",
  "audit_type": "policy_evaluation",
  "user_id": "uuid",
  "action": "delete_user",
  "resource": "user:456",
  "result": "deny",
  "reason": "Insufficient permissions",
  "ip_address": "192.168.1.1",
  "timestamp": "2024-01-25T10:30:45.123Z",
  "metadata": {
    "policy_id": "policy-uuid",
    "applied_rules": ["rule1", "rule2"]
  }
}
```

## Performance Metrics Log

For performance tracking:

```json
{
  "level": "info",
  "message": "Performance metric",
  "metric_type": "database_query",
  "operation": "SELECT",
  "table": "users",
  "duration_ms": 45,
  "rows_affected": 1,
  "metadata": {
    "query_hash": "abc123",
    "connection_pool": "main"
  }
}
```

## Implementation Examples

### TypeScript (Backend/Executor)

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'aegis-backend'
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});

// Usage
logger.info('User login successful', {
  user_id: '123',
  method: 'POST',
  path: '/api/v1/auth/login',
  duration_ms: 45
});
```

### Python (AI Engine)

```python
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname.lower(),
            'service': 'aegis-ai-engine',
            'message': record.getMessage(),
        }
        
        # Add extra fields
        if hasattr(record, 'user_id'):
            log_record['user_id'] = record.user_id
        if hasattr(record, 'duration_ms'):
            log_record['duration_ms'] = record.duration_ms
        
        return json.dumps(log_record)

# Usage
logger = logging.getLogger('ai-engine')
logger.setLevel(logging.INFO)

handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)

logger.info('Anomaly detected', extra={
    'model_type': 'isolation_forest',
    'is_anomaly': True,
    'confidence': 0.92
})
```

## Best Practices

1. **Always include timestamp**: Use ISO 8601 format
2. **Use consistent service names**: `aegis-backend`, `aegis-ai-engine`, `aegis-executor`
3. **Include trace IDs**: For distributed tracing
4. **Add context**: Include relevant metadata
5. **Don't log sensitive data**: No passwords, tokens, or PII
6. **Use appropriate log levels**: Don't abuse error/fatal
7. **Keep messages concise**: Clear and actionable
8. **Structure error objects**: Include type, message, stack
9. **Include performance metrics**: duration_ms for operations
10. **Add user context**: user_id when available

## Sampling

For high-volume logs, implement sampling:

- **Debug logs**: Sample at 10%
- **Info logs**: Sample at 50%
- **Warn/Error logs**: Never sample
- **Audit logs**: Never sample

## Retention

- **Debug**: 7 days
- **Info**: 30 days
- **Warn**: 90 days
- **Error**: 180 days
- **Audit**: 365 days

## Log Aggregation

All logs are sent to Loki via Promtail:

```yaml
# Promtail scrape config
- job_name: aegis
  static_configs:
    - targets:
        - localhost
      labels:
        job: aegis-backend
        __path__: /var/log/aegis/backend/*.log
  pipeline_stages:
    - json:
        expressions:
          level: level
          message: message
          user_id: user_id
    - labels:
        level:
```

## Monitoring & Alerting

Alert on:
- Error rate > 5%
- Fatal logs
- Repeated errors (same error > 10 times in 5 min)
- Missing logs (no logs for > 5 min)

## Compliance

For regulatory compliance:
- Retain audit logs for required period
- Encrypt logs at rest
- Implement access controls
- Regular log review
- Incident response procedures
