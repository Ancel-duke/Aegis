# Aegis Observability Stack

Complete observability solution with metrics, logs, traces, and alerting for the Aegis platform.

## Stack Components

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Loki** - Log aggregation
- **Tempo** - Distributed tracing
- **OpenTelemetry Collector** - Telemetry collection and export
- **AlertManager** - Alert routing and management
- **Promtail** - Log collection agent
- **Node Exporter** - Host metrics

## Quick Start

### 1. Configuration

```bash
cd observability

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Start Observability Stack

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps
```

### 3. Access Dashboards

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093

### 4. Instrument Services

Add metrics endpoints to each service:

**Backend** (NestJS):
```typescript
// Copy instrumentation/backend-metrics.ts to backend/src/metrics/
import { initializeOpenTelemetry, MetricsService } from './metrics/backend-metrics';

// Initialize in main.ts
initializeOpenTelemetry();

// Add /metrics endpoint
@Controller('metrics')
export class MetricsController {
  @Get()
  @Public()
  async getMetrics() {
    return await metricsService.getMetrics();
  }
}
```

**AI Engine** (Python):
```python
# Copy instrumentation/ai-engine-metrics.py to ai-engine/app/metrics/
from app.metrics.ai_engine_metrics import initialize_opentelemetry, setup_metrics_endpoint

app = FastAPI()

# Initialize OpenTelemetry
tracer, meter = initialize_opentelemetry(app)

# Add metrics endpoint
setup_metrics_endpoint(app)
```

**Executor** (NestJS):
```typescript
// Copy instrumentation/executor-metrics.ts to executor/src/metrics/
import { ExecutorMetricsService } from './metrics/executor-metrics';

// Add /metrics endpoint
@Controller('metrics')
export class MetricsController {
  @Get()
  @Public()
  async getMetrics() {
    return await metricsService.getMetrics();
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Application Services                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ Backend  │  │AI Engine │  │ Executor │                 │
│  │  :3000   │  │  :8000   │  │  :4000   │                 │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
│       │ /metrics    │ /metrics    │ /metrics              │
└───────┼─────────────┼─────────────┼───────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│              OpenTelemetry Collector                         │
│                    :4317 :4318                               │
└───────┬───────────────┬───────────────┬─────────────────────┘
        │               │               │
        ▼               ▼               ▼
┌─────────────┐  ┌──────────┐  ┌──────────┐
│ Prometheus  │  │   Loki   │  │  Tempo   │
│    :9090    │  │  :3100   │  │  :3200   │
└──────┬──────┘  └─────┬────┘  └─────┬────┘
       │               │             │
       └───────────────┴─────────────┘
                       │
                       ▼
                ┌──────────┐
                │ Grafana  │
                │  :3001   │
                └──────────┘
```

## Metrics Collection

### Available Metrics

#### API Metrics (all services)
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration
- `rate_limit_exceeded_total` - Rate limit hits

#### Backend Metrics
- `auth_attempts_total` - Authentication attempts
- `active_sessions_total` - Active user sessions
- `policy_evaluations_total` - Policy evaluations
- `db_query_duration_seconds` - Database query time
- `redis_cache_hits_total` - Cache hit rate

#### AI Engine Metrics
- `ai_predictions_total` - Total predictions
- `ai_inference_duration_seconds` - Inference time
- `ai_anomalies_detected_total` - Anomalies found
- `ai_model_confidence_score` - Model confidence
- `ai_model_accuracy` - Model accuracy

#### Executor Metrics
- `executor_actions_total` - K8s actions executed
- `executor_action_duration_seconds` - Action duration
- `executor_policy_checks_total` - Policy checks
- `executor_k8s_api_calls_total` - K8s API calls

### Prometheus Queries

**API Error Rate**:
```promql
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

**API Latency P95**:
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Anomaly Detection Rate**:
```promql
rate(ai_anomalies_detected_total[5m])
```

**Executor Success Rate**:
```promql
rate(executor_actions_total{status="completed"}[5m]) / rate(executor_actions_total[5m])
```

## Log Aggregation

### Log Format

All services emit structured JSON logs:

```json
{
  "timestamp": "2024-01-25T10:30:45.123Z",
  "level": "info",
  "service": "aegis-backend",
  "message": "User login successful",
  "trace_id": "a1b2c3d4e5f6",
  "user_id": "uuid",
  "duration_ms": 123
}
```

See [loki/log-format-spec.md](loki/log-format-spec.md) for complete specification.

### Loki Queries

**Recent Errors**:
```logql
{job="aegis-backend"} |= "error" | json | level="error"
```

**Slow Requests**:
```logql
{job="aegis-backend"} | json | duration_ms > 1000
```

**User Activity**:
```logql
{job="aegis-backend"} | json | user_id="uuid-here"
```

## Distributed Tracing

### OpenTelemetry Integration

Traces are automatically collected via OpenTelemetry instrumentation:

**View Traces in Grafana**:
1. Go to Explore
2. Select Tempo data source
3. Search by trace ID or service

**Trace Context Propagation**:
```typescript
// Traces automatically propagate across services
// Backend -> AI Engine -> Executor
// All linked by trace_id
```

## Alerting

### Alert Rules

Configured in [prometheus/alerts.yml](prometheus/alerts.yml):

- **HighAPIErrorRate**: Error rate > 5%
- **HighAPILatency**: P99 latency > 2s
- **HighInferenceLatency**: AI inference > 1s
- **HighExecutorFailureRate**: Action failure > 20%
- **ServiceDown**: Service unavailable
- **HighCPUUsage**: CPU > 80%
- **HighMemoryUsage**: Memory > 85%

### Alert Routing

Configured in [alertmanager/config.yml](alertmanager/config.yml):

- **Critical** → PagerDuty + Slack
- **Warning** → Slack
- **API issues** → #api-team
- **ML issues** → #ml-team
- **Infrastructure** → #ops-team

## Grafana Dashboards

### Pre-configured Dashboards

1. **Aegis Overview** - System-wide metrics
2. **API Performance** - Request rates, latency, errors
3. **AI Engine** - Model performance, anomalies
4. **Executor** - K8s actions, success rates
5. **Infrastructure** - CPU, memory, disk, network

### Creating Custom Dashboards

```bash
# Add dashboard JSON to grafana/dashboards/
# Auto-provisioned on startup
```

## AI Engine Integration

### Metrics Feed

The AI Engine can fetch metrics from Prometheus for anomaly detection:

```python
from integration.ai_engine_metrics_feed import PrometheusMetricsFeed

# Initialize feed
feed = PrometheusMetricsFeed('http://prometheus:9090')

# Get metrics for analysis
metrics = await feed.get_metrics_for_anomaly_detection(duration_minutes=60)

# Analyze with AI Engine
result = await anomaly_detector.detect(metrics['api'])
```

See [integration/ai-engine-metrics-feed.py](integration/ai-engine-metrics-feed.py) for complete implementation.

## Security

### SSL/TLS

For production, enable TLS:

```yaml
# docker-compose.yml
prometheus:
  command:
    - '--web.config.file=/etc/prometheus/web-config.yml'
  volumes:
    - ./prometheus/web-config.yml:/etc/prometheus/web-config.yml
    - ./ssl:/etc/prometheus/ssl
```

### Authentication

Grafana authentication is enabled by default. Configure in `.env`:

```env
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your_secure_password
```

### Network Security

- Expose only necessary ports
- Use Docker networks for isolation
- Configure firewall rules
- Enable authentication on all services

## Monitoring the Monitors

### Health Checks

```bash
# Prometheus
curl http://localhost:9090/-/healthy

# Grafana
curl http://localhost:3001/api/health

# Loki
curl http://localhost:3100/ready

# OpenTelemetry Collector
curl http://localhost:13133/
```

### Resource Usage

```bash
# Check container stats
docker stats aegis-prometheus aegis-grafana aegis-loki

# Prometheus storage
curl http://localhost:9090/api/v1/status/tsdb

# Loki stats
curl http://localhost:3100/metrics | grep loki
```

## Troubleshooting

### Metrics Not Appearing

1. **Check service /metrics endpoint**:
```bash
curl http://localhost:3000/metrics
curl http://localhost:8000/metrics
curl http://localhost:4000/metrics
```

2. **Check Prometheus targets**:
- Go to http://localhost:9090/targets
- Verify all targets are "UP"

3. **Check network connectivity**:
```bash
docker exec aegis-prometheus wget -O- http://host.docker.internal:3000/metrics
```

### Logs Not Appearing

1. **Check Promtail is running**:
```bash
docker logs aegis-promtail-obs
```

2. **Check Loki ingestion**:
```bash
curl http://localhost:3100/ready
```

3. **Verify log format**:
- Ensure logs are in JSON format
- Check log file paths in promtail-config.yml

### High Resource Usage

**Prometheus**:
```bash
# Reduce retention
docker-compose down
# Edit prometheus.yml: --storage.tsdb.retention.time=15d
docker-compose up -d
```

**Loki**:
```bash
# Reduce retention in loki-config.yml
retention_period: 30d
```

## Performance Tuning

### Prometheus

```yaml
# prometheus.yml
global:
  scrape_interval: 30s  # Increase for less load
  evaluation_interval: 30s
```

### Loki

```yaml
# loki-config.yml
limits_config:
  ingestion_rate_mb: 32  # Increase if dropping logs
  ingestion_burst_size_mb: 64
```

### Grafana

```yaml
# docker-compose.yml
grafana:
  environment:
    - GF_RENDERING_SERVER_URL=http://renderer:8081
    - GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=/var/lib/grafana/dashboards/overview.json
```

## Backup & Recovery

### Prometheus Data

```bash
# Backup
docker exec aegis-prometheus tar czf /prometheus/backup.tar.gz /prometheus/data

# Restore
docker exec aegis-prometheus tar xzf /prometheus/backup.tar.gz -C /prometheus
```

### Grafana Dashboards

```bash
# Export dashboards
curl -u admin:password http://localhost:3001/api/dashboards/db/aegis-overview -o dashboard.json

# Import via UI or provisioning
cp dashboard.json grafana/dashboards/
```

## Production Checklist

- [ ] Change default Grafana password
- [ ] Configure Slack webhook for alerts
- [ ] Set up PagerDuty integration
- [ ] Enable SSL/TLS on all services
- [ ] Configure proper retention periods
- [ ] Set up backup automation
- [ ] Review and tune resource limits
- [ ] Configure proper log rotation
- [ ] Set up external storage (S3, etc.)
- [ ] Test alert routing
- [ ] Document runbooks
- [ ] Train team on dashboards

## Cost Optimization

### Storage

- **Prometheus**: 1-2 GB per day for 3 services
- **Loki**: 500 MB - 1 GB per day
- **Tempo**: 100-500 MB per day

### Optimization Tips

1. Increase scrape intervals
2. Reduce retention periods
3. Use recording rules for expensive queries
4. Sample high-cardinality metrics
5. Aggregate logs before ingestion

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Tempo Documentation](https://grafana.com/docs/tempo/)

## Support

For observability issues:
1. Check service logs: `docker-compose logs [service]`
2. Verify connectivity between services
3. Review Prometheus targets: http://localhost:9090/targets
4. Check Grafana data sources
5. Consult troubleshooting section above

## License

MIT
