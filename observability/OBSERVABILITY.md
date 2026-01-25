# Aegis Observability - Quick Start

Complete monitoring, logging, and tracing for Aegis in 5 minutes.

## What You Get

✅ **Prometheus** - Scrapes metrics from all services every 15s  
✅ **Grafana** - Pre-configured dashboards for all services  
✅ **Loki** - Centralized log aggregation with 90-day retention  
✅ **Tempo** - Distributed tracing across all services  
✅ **OpenTelemetry** - Automatic instrumentation  
✅ **AlertManager** - Smart alerting with Slack/PagerDuty  
✅ **Node Exporter** - Host-level metrics  

## 5-Minute Setup

### Step 1: Configure (1 minute)

```bash
cd observability
cp .env.example .env

# Edit Grafana password
nano .env
```

### Step 2: Start Stack (2 minutes)

```bash
docker-compose up -d

# Wait for services to start
docker-compose ps
```

### Step 3: Access Dashboards (1 minute)

Open in browser:
- **Grafana**: http://localhost:3001 (admin/your_password)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093

### Step 4: Instrument Services (1 minute)

**Add to each service's package.json/requirements.txt**:

```bash
# Backend (NestJS)
npm install prom-client @opentelemetry/api @opentelemetry/sdk-node

# AI Engine (Python)
pip install prometheus-client opentelemetry-api opentelemetry-sdk

# Executor (NestJS)
npm install prom-client @opentelemetry/api @opentelemetry/sdk-node
```

### Step 5: Verify (30 seconds)

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Check metrics are being collected
curl http://localhost:9090/api/v1/query?query=up
```

## Quick Usage

### View Metrics in Prometheus

```bash
# Open Prometheus
open http://localhost:9090

# Example queries:
# - rate(http_requests_total[5m])
# - histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
# - ai_anomalies_detected_total
```

### View Logs in Grafana

```bash
# Open Grafana
open http://localhost:3001

# Go to Explore → Select Loki
# Query: {job="aegis-backend"} | json | level="error"
```

### View Traces in Grafana

```bash
# Open Grafana → Explore → Select Tempo
# Search by service name or trace ID
```

## Instrumentation

### Backend (NestJS)

```typescript
// src/main.ts
import { initializeOpenTelemetry } from './metrics/backend-metrics';

async function bootstrap() {
  // Initialize OpenTelemetry first
  initializeOpenTelemetry();
  
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

// src/metrics/metrics.controller.ts
@Controller('metrics')
export class MetricsController {
  @Get()
  @Public()
  async getMetrics() {
    return await register.metrics();
  }
}
```

### AI Engine (Python)

```python
# app/main.py
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

# Use in services
@router.post("/detect-anomaly")
async def detect_anomaly(data: AnomalyRequest):
    start = time.time()
    
    result = await anomaly_detector.detect(data)
    duration = time.time() - start
    
    metrics_service.track_prediction(
        model_type='anomaly',
        duration=duration,
        success=True,
        confidence=result['confidence']
    )
    
    return result
```

### Executor (NestJS)

```typescript
// src/executor/executor.service.ts
async executeAction(dto: ExecuteActionDto) {
  const start = Date.now();
  
  try {
    const result = await this.performAction(dto);
    
    const duration = (Date.now() - start) / 1000;
    this.metricsService.trackAction(
      dto.actionType,
      dto.actionParams.namespace,
      'completed',
      duration
    );
    
    return result;
  } catch (error) {
    this.metricsService.trackError(error.name, dto.actionType);
    throw error;
  }
}
```

## Key Metrics to Watch

### Golden Signals

**Latency**:
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Traffic**:
```promql
rate(http_requests_total[5m])
```

**Errors**:
```promql
rate(http_requests_total{status=~"5.."}[5m])
```

**Saturation**:
```promql
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes
```

### AI Engine Specific

**Anomaly Detection Rate**:
```promql
rate(ai_anomalies_detected_total[5m])
```

**Model Confidence**:
```promql
histogram_quantile(0.50, rate(ai_model_confidence_score_bucket[5m]))
```

**Inference Latency**:
```promql
histogram_quantile(0.99, rate(ai_inference_duration_seconds_bucket[5m]))
```

### Executor Specific

**Action Success Rate**:
```promql
rate(executor_actions_total{status="completed"}[5m]) / rate(executor_actions_total[5m])
```

**K8s API Errors**:
```promql
rate(executor_k8s_api_calls_total{status="error"}[5m])
```

## Alerting

### Test Alerts

```bash
# Trigger test alert
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning"
    },
    "annotations": {
      "summary": "Test alert"
    }
  }]'
```

### Configure Slack

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Configure PagerDuty

```env
PAGERDUTY_SERVICE_KEY=your_service_key
```

## AI Engine Anomaly Detection on Metrics

### Scheduled Metrics Analysis

```python
# In AI Engine
import asyncio
from integration.ai_engine_metrics_feed import PrometheusMetricsFeed

async def analyze_metrics_periodically():
    """Run every 5 minutes to analyze system metrics"""
    
    feed = PrometheusMetricsFeed('http://prometheus:9090')
    
    while True:
        try:
            # Fetch last hour of metrics
            metrics = await feed.get_metrics_for_anomaly_detection(60)
            
            # Analyze API metrics
            api_result = await anomaly_detector.detect(metrics['api'])
            
            if api_result['is_anomaly'] and api_result['severity'] == 'high':
                logger.warning(f"API anomaly detected: {api_result}")
                
                # Trigger remediation workflow
                await trigger_remediation(api_result)
            
            # Analyze infrastructure metrics
            infra_result = await anomaly_detector.detect(metrics['infrastructure'])
            
            if infra_result['is_anomaly']:
                logger.warning(f"Infrastructure anomaly: {infra_result}")
        
        except Exception as e:
            logger.error(f"Metrics analysis failed: {e}")
        
        # Wait 5 minutes
        await asyncio.sleep(300)

# Start background task
asyncio.create_task(analyze_metrics_periodically())
```

## Common Queries

### Find Slow Requests

**PromQL**:
```promql
topk(10, histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])))
```

**LogQL**:
```logql
{job=~"aegis-.*"} | json | duration_ms > 1000 | line_format "{{.message}} - {{.duration_ms}}ms"
```

### Error Investigation

**PromQL**:
```promql
rate(http_requests_total{status=~"5.."}[5m]) by (service, path)
```

**LogQL**:
```logql
{job="aegis-backend"} | json | level="error" | line_format "{{.timestamp}} {{.message}}"
```

### User Activity

**LogQL**:
```logql
{job="aegis-backend"} | json | user_id="uuid-here" | line_format "{{.timestamp}} {{.message}}"
```

## Best Practices

1. **Instrument Early**: Add metrics/tracing from the start
2. **Use Labels Wisely**: Don't create high-cardinality labels
3. **Alert on Symptoms**: Alert on user-visible issues
4. **Dashboard per Service**: One dashboard per service
5. **SLO Tracking**: Define and track Service Level Objectives
6. **Regular Reviews**: Review dashboards and alerts monthly
7. **Cost Monitoring**: Track storage and resource usage

## SLO Examples

```yaml
# Backend API
- Availability: 99.9%
- Latency P95: < 500ms
- Error Rate: < 1%

# AI Engine
- Inference Latency P99: < 1s
- Model Accuracy: > 90%
- Anomaly Detection: < 5% false positives

# Executor
- Action Success Rate: > 95%
- Action Latency P95: < 5s
- Policy Check: < 100ms
```

## Next Steps

1. **Import Dashboards**: Import pre-built dashboards
2. **Configure Alerts**: Set up Slack/PagerDuty
3. **Test Alerts**: Trigger test alerts
4. **Train Team**: Show team how to use dashboards
5. **Set Up SLOs**: Define and track objectives
6. **Document Runbooks**: Create runbooks for alerts

## Resources Provided

- ✅ Docker Compose with all services
- ✅ Prometheus configuration with alerts
- ✅ Loki configuration with retention
- ✅ OpenTelemetry Collector setup
- ✅ Tempo for distributed tracing
- ✅ Grafana with pre-configured data sources
- ✅ AlertManager with routing rules
- ✅ Instrumentation code for all services
- ✅ AI Engine metrics feed integration
- ✅ Log format specification
- ✅ Example queries and dashboards

---

**Total Setup Time**: 5 minutes  
**Services**: 8 containers  
**Resource Usage**: ~2GB RAM, ~5GB disk
