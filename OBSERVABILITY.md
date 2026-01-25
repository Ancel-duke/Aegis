# Aegis Observability - Quick Reference

Complete monitoring solution with Prometheus, Loki, Tempo, and Grafana.

## Quick Start

```bash
cd observability
docker-compose up -d

# Access dashboards
open http://localhost:3001  # Grafana
open http://localhost:9090  # Prometheus
```

## Services

| Service | Port | Purpose |
|---------|------|---------|
| Grafana | 3001 | Dashboards & visualization |
| Prometheus | 9090 | Metrics collection |
| Loki | 3100 | Log aggregation |
| Tempo | 3200 | Distributed tracing |
| OpenTelemetry | 4317/4318 | Telemetry collection |
| AlertManager | 9093 | Alert routing |

## Key Metrics

### API Health
```promql
# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Latency P95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Request rate
rate(http_requests_total[5m])
```

### AI Engine
```promql
# Anomalies per second
rate(ai_anomalies_detected_total[5m])

# Model confidence
histogram_quantile(0.50, rate(ai_model_confidence_score_bucket[5m]))

# Inference latency
histogram_quantile(0.99, rate(ai_inference_duration_seconds_bucket[5m]))
```

### Executor
```promql
# Action success rate
rate(executor_actions_total{status="completed"}[5m]) / rate(executor_actions_total[5m])

# Failed actions
rate(executor_actions_total{status="failed"}[5m])
```

## Log Queries

### Recent Errors
```logql
{job=~"aegis-.*"} | json | level="error" | line_format "{{.timestamp}} {{.service}}: {{.message}}"
```

### Slow Requests
```logql
{job="aegis-backend"} | json | duration_ms > 1000
```

### Anomaly Detections
```logql
{job="aegis-ai-engine"} | json | is_anomaly="true" | line_format "{{.severity}}: {{.message}}"
```

### Failed K8s Actions
```logql
{job="aegis-executor"} | json | status="failed" | line_format "{{.action_type}} on {{.resource_name}}: {{.error_message}}"
```

## Instrumentation

### Backend (NestJS)

```typescript
import { MetricsService } from './metrics/backend-metrics';

// Track request
metricsService.trackHttpRequest('POST', '/api/v1/users', 201, 0.045);

// Track auth
metricsService.trackAuthAttempt('login', true);

// Track policy
metricsService.trackPolicyEvaluation('create_user', 'allow', 0.012);
```

### AI Engine (Python)

```python
from app.metrics.ai_engine_metrics import metrics_service

# Track prediction
metrics_service.track_prediction(
    model_type='anomaly',
    duration=0.234,
    success=True,
    confidence=0.92
)

# Track anomaly
metrics_service.track_anomaly(severity='high')
```

### Executor (NestJS)

```typescript
import { ExecutorMetricsService } from './metrics/executor-metrics';

// Track action
metricsService.trackAction('restart_pod', 'production', 'completed', 1.234);

// Track policy check
metricsService.trackPolicyCheck(true, 0.045);

// Track K8s API call
metricsService.trackK8sApiCall('delete', 'pod', 'success', 0.567);
```

## AI Engine Metrics Feed

### Fetch Metrics for Analysis

```python
from integration.ai_engine_metrics_feed import PrometheusMetricsFeed

feed = PrometheusMetricsFeed('http://prometheus:9090')

# Get all metrics for last hour
metrics = await feed.get_metrics_for_anomaly_detection(duration_minutes=60)

# Analyze
result = await anomaly_detector.detect(metrics['api'])

if result['is_anomaly']:
    print(f"Anomaly: {result['severity']}")
    print(f"Action: {result['recommended_action']}")
```

### Scheduled Analysis

```python
# Run every 5 minutes
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('interval', minutes=5)
async def analyze_metrics():
    metrics = await feed.get_metrics_for_anomaly_detection(60)
    
    for category, data in metrics.items():
        result = await detector.detect(data)
        if result['is_anomaly']:
            await handle_anomaly(category, result)
```

## Alerts

### Configure Slack

```env
# .env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
```

### Configure PagerDuty

```env
PAGERDUTY_SERVICE_KEY=your_key_here
```

### Test Alerting

```bash
# Trigger test alert
curl -X POST http://localhost:9093/api/v1/alerts \
  -d '[{"labels":{"alertname":"Test"}}]'
```

## Dashboards

Access pre-configured dashboards:

1. **Overview** - System-wide metrics
2. **API Performance** - Backend metrics
3. **AI Engine** - Model performance
4. **Executor** - K8s operations
5. **Infrastructure** - Host metrics

## Security

### Enable TLS

```yaml
# prometheus/web-config.yml
tls_server_config:
  cert_file: /etc/prometheus/ssl/server.crt
  key_file: /etc/prometheus/ssl/server.key
```

### Authentication

Grafana has built-in auth (admin/password).

For Prometheus, use reverse proxy with auth.

## Troubleshooting

### Service Not Scraped

```bash
# 1. Check /metrics endpoint
curl http://localhost:3000/metrics

# 2. Check Prometheus targets
open http://localhost:9090/targets

# 3. Check network
docker exec aegis-prometheus wget -O- http://host.docker.internal:3000/metrics
```

### No Logs in Loki

```bash
# 1. Check Promtail
docker logs aegis-promtail-obs

# 2. Check Loki
curl http://localhost:3100/ready

# 3. Verify log format (must be JSON)
```

### High Resource Usage

```bash
# Check stats
docker stats

# Reduce scrape frequency
# Edit prometheus.yml: scrape_interval: 30s

# Reduce retention
# Edit prometheus.yml: --storage.tsdb.retention.time=15d
```

## Production Checklist

- [ ] Change Grafana admin password
- [ ] Configure Slack/PagerDuty webhooks
- [ ] Enable SSL/TLS on all services
- [ ] Set appropriate retention periods
- [ ] Configure backup for Prometheus data
- [ ] Set up long-term storage
- [ ] Create custom dashboards
- [ ] Document alert runbooks
- [ ] Test disaster recovery
- [ ] Train team on tools

## Resources

- [Full Documentation](observability/README.md)
- [Log Format Spec](observability/loki/log-format-spec.md)
- [Metrics Integration](observability/examples/metrics-integration.md)
- [Prometheus Queries](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [LogQL Queries](https://grafana.com/docs/loki/latest/logql/)

---

**Estimated Setup Time**: 5 minutes  
**Resource Usage**: ~2GB RAM, ~5GB disk  
**Data Retention**: Metrics 30d, Logs 90d, Traces 7d
