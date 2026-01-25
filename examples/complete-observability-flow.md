# Complete Observability Flow

End-to-end example showing how metrics, logs, and traces flow through the Aegis platform.

## Scenario: API Request → Anomaly Detection → Auto-Remediation

### 1. User Makes API Request

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "firstName": "John"}'
```

### 2. Backend Emits Telemetry

**Metrics** (Prometheus):
```typescript
// Automatically tracked
metricsService.trackHttpRequest('POST', '/api/v1/users', 201, 0.045);
metricsService.trackDbQuery('insert', 'users', 0.023);
```

**Logs** (Loki):
```json
{
  "timestamp": "2024-01-25T14:30:45.123Z",
  "level": "info",
  "service": "aegis-backend",
  "message": "User created successfully",
  "trace_id": "a1b2c3d4e5f6",
  "method": "POST",
  "path": "/api/v1/users",
  "status_code": 201,
  "duration_ms": 45,
  "user_id": "admin-uuid"
}
```

**Traces** (Tempo):
```
Trace: a1b2c3d4e5f6
├─ Span: http.request [45ms]
├─ Span: auth.verify [5ms]
├─ Span: policy.evaluate [12ms]
└─ Span: db.insert [23ms]
```

### 3. Prometheus Scrapes Metrics

```promql
# Every 15 seconds
scrape_interval: 15s

# Metrics collected:
http_requests_total{service="backend",method="POST",path="/api/v1/users",status="201"} 1
http_request_duration_seconds{service="backend"} 0.045
policy_evaluations_total{action="create_user",result="allow"} 1
```

### 4. Metrics Stored and Queryable

**Query in Prometheus**:
```promql
# Request rate
rate(http_requests_total{service="backend"}[5m])

# Result: 25 requests/second
```

**Query in Grafana**:
- Open Grafana Dashboard
- See real-time request rate graph
- See latency percentiles

### 5. AI Engine Fetches Metrics (Every 5 Minutes)

```python
# Scheduled task in AI Engine
async def analyze_metrics():
    # Fetch last hour of metrics
    feed = PrometheusMetricsFeed('http://prometheus:9090')
    metrics = await feed.get_metrics_for_anomaly_detection(60)
    
    # metrics['api'] contains:
    [
        {
            'metric_type': 'request_rate',
            'value': 125.5,  # Unusual spike!
            'timestamp': '2024-01-25T14:30:00Z',
            'labels': {'service': 'backend'}
        },
        {
            'metric_type': 'error_rate',
            'value': 0.08,  # 8% errors - high!
            'timestamp': '2024-01-25T14:30:00Z',
            'labels': {'service': 'backend'}
        },
        # ... more metrics
    ]
```

### 6. AI Engine Detects Anomaly

```python
# Run anomaly detection
result = await anomaly_detector.detect(metrics['api'])

# Result:
{
    'is_anomaly': True,
    'anomaly_score': 0.87,
    'severity': 'high',
    'recommended_action': 'scale_up',
    'confidence': 0.92,
    'affected_metrics': ['request_rate', 'error_rate'],
    'details': {
        'request_rate': {
            'current': 125.5,
            'expected': 50.0,
            'deviation': 2.5  # sigma
        },
        'error_rate': {
            'current': 0.08,
            'expected': 0.01,
            'deviation': 3.5  # sigma
        }
    }
}
```

### 7. AI Engine Emits Detection Metrics

```python
# Track the detection
metrics_service.track_anomaly(severity='high')
metrics_service.track_prediction(
    model_type='anomaly',
    duration=0.234,
    success=True,
    confidence=0.92
)
```

### 8. Query Logs for Context

**LogQL** (to understand what caused the spike):
```logql
{job="aegis-backend"} 
| json 
| line_format "{{.timestamp}} {{.message}}" 
| __timestamp__ > 1706189400
| __timestamp__ < 1706189700
```

**Results**:
```
2024-01-25T14:25:00Z Marketing campaign started
2024-01-25T14:26:00Z Traffic spike detected
2024-01-25T14:27:00Z Database query slow: 2.3s
2024-01-25T14:28:00Z Error: Connection pool exhausted
```

### 9. View Distributed Trace

In Grafana Tempo, search for trace `a1b2c3d4e5f6`:

```
Trace Duration: 2.3s (slow!)

aegis-backend: /api/v1/users [2.3s]
  ├─ auth.verify [5ms]
  ├─ policy.evaluate [12ms]
  └─ db.insert [2.28s] ← Slow!
```

**Root cause identified**: Database connection pool exhausted.

### 10. Remediation Workflow

```python
# AI Engine triggers remediation
if anomaly['severity'] == 'high':
    # Check policy
    policy = await policy_engine.evaluate({
        'action': 'scale_up',
        'resource': 'deployment:backend',
        'context': {
            'severity': 'high',
            'automated': True
        }
    })
    
    if policy['allowed']:
        # Execute via Executor
        result = await executor.scale_deployment(
            namespace='production',
            deployment='backend',
            replicas=8  # Scale from 3 to 8
        )
```

### 11. Executor Emits Action Metrics

```typescript
// Track the action
metricsService.trackAction(
  'scale_deployment',
  'production',
  'completed',
  1.234
);
```

### 12. Monitor Resolution

**Prometheus Query**:
```promql
# Check if request rate normalized
rate(http_requests_total{service="backend"}[5m])
```

**Before**: 125 req/s  
**After**: 50 req/s ✅

**Error rate normalized**:
```promql
rate(http_requests_total{service="backend",status=~"5.."}[5m]) / rate(http_requests_total{service="backend"}[5m])
```

**Before**: 0.08 (8%)  
**After**: 0.01 (1%) ✅

## Complete Data Flow Visualization

```
┌────────────────────────────────────────────────────────────────┐
│                      User Request                               │
│                   POST /api/v1/users                            │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                    Backend Service                              │
│  • Process request                                              │
│  • Emit metrics → Prometheus                                    │
│  • Emit logs → Loki                                            │
│  • Emit traces → Tempo                                         │
└──────────────────────────┬─────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
┌───────────────┐  ┌──────────────┐  ┌──────────────┐
│  Prometheus   │  │     Loki     │  │    Tempo     │
│   Metrics     │  │     Logs     │  │   Traces     │
└───────┬───────┘  └──────┬───────┘  └──────┬───────┘
        │                 │                 │
        └─────────────────┴─────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │    Grafana    │
                  │  Dashboards   │
                  └───────┬───────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
  ┌───────────────┐              ┌───────────────┐
  │   Operator    │              │  AI Engine    │
  │   (Human)     │              │  (Automated)  │
  │               │              │               │
  │ • Views alerts│              │ • Fetches     │
  │ • Investigates│              │   metrics     │
  │ • Takes action│              │ • Detects     │
  └───────────────┘              │   anomalies   │
                                 │ • Triggers    │
                                 │   remediation │
                                 └───────────────┘
```

## Querying the Full Context

### Grafana Explore

1. **Start with Metrics** (Prometheus):
```promql
rate(http_requests_total{service="backend"}[5m])
```
→ See spike at 14:25

2. **Check Logs** (Loki):
```logql
{job="aegis-backend"} 
| json 
| __timestamp__ >= 1706189100  
| __timestamp__ <= 1706189700
```
→ See "Marketing campaign started" at 14:25

3. **Drill into Traces** (Tempo):
- Click on trace ID from logs
- See full request breakdown
- Identify slow database query

4. **Correlate Everything**:
- Metrics show: High load
- Logs explain: Marketing campaign
- Traces reveal: Database bottleneck

## Real-World Alerts

### Alert 1: High Error Rate

**Triggered**:
```
[ALERT] HighAPIErrorRate
Service: aegis-backend
Error Rate: 8.2% (threshold: 5%)
Duration: 5 minutes
```

**Investigation in Grafana**:
1. Open Prometheus → Query error rate
2. Switch to Loki → Filter errors
3. Click trace ID → View in Tempo
4. Find root cause: Database timeout

**Action**:
- Automated: AI Engine scales database
- Manual: DBA investigates query

### Alert 2: Anomaly Detected

**Triggered**:
```
[ALERT] AnomalyDetectionSpike
AI Engine detected 15 anomalies in 5 minutes
Severity: high
Confidence: 0.92
```

**Investigation**:
1. Check AI Engine logs
2. Review affected metrics
3. Verify remediation actions
4. Monitor resolution

## Performance Metrics

### Before Observability

❌ MTTR (Mean Time To Repair): 45 minutes  
❌ Root cause identification: 30 minutes  
❌ Manual investigation required  
❌ No automated detection  

### With Observability

✅ MTTR: 2 minutes (automated)  
✅ Root cause identification: 30 seconds  
✅ Automated detection and remediation  
✅ Complete audit trail  

## Best Practices

### 1. Metrics

- Export from every service
- Use consistent naming
- Keep cardinality low
- Include service labels

### 2. Logs

- Use structured JSON format
- Include trace IDs
- Add correlation fields
- Don't log sensitive data

### 3. Traces

- Instrument all services
- Propagate context
- Add meaningful attributes
- Sample appropriately

### 4. Dashboards

- One per service
- Include SLO tracking
- Add annotations
- Link to runbooks

### 5. Alerts

- Alert on symptoms
- Include context
- Link to dashboards
- Document response

## Troubleshooting Guide

### Symptom: High Latency

**Step 1**: Check Prometheus
```promql
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

**Step 2**: Check Logs
```logql
{job="aegis-backend"} | json | duration_ms > 1000
```

**Step 3**: Check Traces
- Find slow traces in Tempo
- Identify bottleneck span

**Step 4**: Take Action
- Scale if CPU/memory high
- Optimize query if database slow
- Add caching if repeated calls

### Symptom: Error Spike

**Step 1**: Check error rate
```promql
rate(http_requests_total{status=~"5.."}[5m])
```

**Step 2**: Find error messages
```logql
{job="aegis-backend"} | json | level="error"
```

**Step 3**: Check related traces
- Filter traces by error status
- Review error spans

**Step 4**: Correlate with changes
- Check if new deployment
- Review recent configuration changes
- Check external dependencies

## Success Metrics

Track these KPIs:

- **Detection Time**: Time to detect issues (target: < 1 min)
- **MTTR**: Mean time to repair (target: < 5 min)
- **False Positive Rate**: Incorrect alerts (target: < 5%)
- **Alert Fatigue**: Alerts per day (target: < 10)
- **Automation Rate**: Issues auto-resolved (target: > 80%)

## Next Steps

1. **Set Up Alerts**: Configure Slack/PagerDuty
2. **Create Dashboards**: Import or create custom dashboards
3. **Define SLOs**: Set service level objectives
4. **Train Team**: Show team how to use tools
5. **Document Runbooks**: Create response procedures
6. **Test Failovers**: Verify monitoring survives failures

## Resources

- [Observability Documentation](../observability/README.md)
- [Metrics Integration](../observability/examples/metrics-integration.md)
- [Log Format Spec](../observability/loki/log-format-spec.md)
- [Prometheus Queries](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [LogQL Guide](https://grafana.com/docs/loki/latest/logql/)
- [Tempo Tracing](https://grafana.com/docs/tempo/latest/)

---

**With complete observability, Aegis can detect, diagnose, and resolve issues in under 2 minutes!** 🎉
