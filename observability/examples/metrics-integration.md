# Metrics Integration Guide

Complete guide for integrating Prometheus metrics with AI Engine anomaly detection.

## Architecture

```
┌──────────────┐     scrape      ┌────────────┐
│  Backend     │◄────────────────┤ Prometheus │
│  :3000       │                 │   :9090    │
└──────────────┘                 └─────┬──────┘
                                       │
┌──────────────┐     scrape            │ query
│ AI Engine    │◄──────────────────────┤
│  :8000       │                       │
└──────────────┘                       │
                                       │
┌──────────────┐     scrape            │
│  Executor    │◄──────────────────────┤
│  :4000       │                       │
└──────────────┘                       │
                                       │
         ┌─────────────────────────────┘
         │
         ▼
┌──────────────────┐
│   AI Engine      │
│ Metrics Analysis │
│  (anomaly feed)  │
└──────────────────┘
```

## Step 1: Export Metrics from Services

### Backend - Add Metrics Endpoint

```bash
cd backend/src

# Copy instrumentation code
cp ../../observability/instrumentation/backend-metrics.ts ./metrics/

# Install dependencies
npm install prom-client @opentelemetry/api @opentelemetry/sdk-node \
  @opentelemetry/instrumentation-http @opentelemetry/instrumentation-express \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http
```

```typescript
// src/main.ts
import { initializeOpenTelemetry } from './metrics/backend-metrics';

async function bootstrap() {
  initializeOpenTelemetry();
  // ... rest of setup
}

// src/app.module.ts
import { MetricsController } from './metrics/metrics.controller';
import { MetricsService } from './metrics/backend-metrics';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
```

### AI Engine - Add Metrics Endpoint

```bash
cd ai-engine/app

# Copy instrumentation code
cp ../../observability/instrumentation/ai-engine-metrics.py ./metrics/

# Install dependencies
pip install prometheus-client opentelemetry-api opentelemetry-sdk \
  opentelemetry-instrumentation-fastapi opentelemetry-exporter-otlp
```

```python
# app/main.py
from app.metrics.ai_engine_metrics import (
    initialize_opentelemetry,
    setup_metrics_endpoint,
    metrics_service
)

app = FastAPI()

# Initialize
tracer, meter = initialize_opentelemetry(app)
setup_metrics_endpoint(app)

# Use metrics service
from app.metrics.ai_engine_metrics import metrics_service

@router.post("/detect-anomaly")
async def detect_anomaly(data: AnomalyRequest):
    start = time.time()
    
    try:
        result = await detector.detect(data.metrics)
        duration = time.time() - start
        
        metrics_service.track_prediction(
            model_type='anomaly',
            duration=duration,
            success=True,
            confidence=result['confidence']
        )
        
        if result['is_anomaly']:
            metrics_service.track_anomaly(result['severity'])
        
        return result
    except Exception as e:
        duration = time.time() - start
        metrics_service.track_prediction(
            model_type='anomaly',
            duration=duration,
            success=False
        )
        raise
```

### Executor - Add Metrics Endpoint

```bash
cd executor/src

# Copy instrumentation code
cp ../../observability/instrumentation/executor-metrics.ts ./metrics/

# Already have dependencies from Backend
```

## Step 2: Configure Prometheus

Edit `observability/prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'aegis-backend'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'aegis-ai-engine'
    static_configs:
      - targets: ['host.docker.internal:8000']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'aegis-executor'
    static_configs:
      - targets: ['host.docker.internal:4000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

## Step 3: AI Engine Metrics Feed

Create scheduled task to analyze metrics:

```python
# ai-engine/app/tasks/metrics_analyzer.py

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from integration.ai_engine_metrics_feed import PrometheusMetricsFeed
from app.services.anomaly_detector import AnomalyDetector
import logging

logger = logging.getLogger(__name__)

class MetricsAnalyzer:
    """Scheduled metrics analysis"""
    
    def __init__(
        self,
        prometheus_url: str,
        anomaly_detector: AnomalyDetector
    ):
        self.feed = PrometheusMetricsFeed(prometheus_url)
        self.detector = anomaly_detector
        self.scheduler = AsyncIOScheduler()
    
    async def analyze_system_metrics(self):
        """Analyze all system metrics for anomalies"""
        logger.info("Starting scheduled metrics analysis")
        
        try:
            # Fetch metrics from last hour
            metrics = await self.feed.get_metrics_for_anomaly_detection(
                duration_minutes=60
            )
            
            # Analyze API metrics
            if metrics['api']:
                api_anomalies = await self.analyze_category('API', metrics['api'])
                if api_anomalies:
                    await self.handle_anomalies('api', api_anomalies)
            
            # Analyze infrastructure metrics
            if metrics['infrastructure']:
                infra_anomalies = await self.analyze_category(
                    'Infrastructure',
                    metrics['infrastructure']
                )
                if infra_anomalies:
                    await self.handle_anomalies('infrastructure', infra_anomalies)
            
            # Analyze AI Engine's own metrics
            if metrics['ai_engine']:
                ai_anomalies = await self.analyze_category(
                    'AI Engine',
                    metrics['ai_engine']
                )
                if ai_anomalies:
                    await self.handle_anomalies('ai_engine', ai_anomalies)
            
            logger.info("Metrics analysis completed")
        
        except Exception as e:
            logger.error(f"Metrics analysis failed: {e}")
    
    async def analyze_category(
        self,
        category: str,
        metrics: List[Dict]
    ) -> List[Dict]:
        """Analyze a category of metrics"""
        logger.info(f"Analyzing {len(metrics)} {category} metrics")
        
        # Transform to AI Engine format
        formatted_metrics = [
            {
                'metric_type': m['metric_type'],
                'value': m['value'],
                'timestamp': m['timestamp'],
                'labels': m['labels']
            }
            for m in metrics
        ]
        
        # Run anomaly detection
        result = await self.detector.detect(formatted_metrics)
        
        if result['is_anomaly']:
            logger.warning(
                f"{category} anomaly detected: "
                f"severity={result['severity']}, "
                f"confidence={result['confidence']}"
            )
            return [result]
        
        return []
    
    async def handle_anomalies(
        self,
        category: str,
        anomalies: List[Dict]
    ):
        """Handle detected anomalies"""
        for anomaly in anomalies:
            # Check with Policy Engine
            policy_decision = await self.check_policy(anomaly)
            
            if policy_decision['allowed']:
                # Trigger remediation via Executor
                await self.trigger_remediation(anomaly, policy_decision)
            else:
                logger.warning(
                    f"Remediation denied by policy: {policy_decision['reason']}"
                )
    
    async def check_policy(self, anomaly: Dict) -> Dict:
        """Check if remediation is allowed"""
        # Implementation here
        pass
    
    async def trigger_remediation(self, anomaly: Dict, policy: Dict):
        """Trigger remediation action"""
        # Implementation here
        pass
    
    def start(self):
        """Start scheduled analysis"""
        # Run every 5 minutes
        self.scheduler.add_job(
            self.analyze_system_metrics,
            'interval',
            minutes=5,
            id='metrics_analysis'
        )
        self.scheduler.start()
        logger.info("Metrics analyzer started (runs every 5 minutes)")
    
    def stop(self):
        """Stop scheduled analysis"""
        self.scheduler.shutdown()
        logger.info("Metrics analyzer stopped")


# Initialize in main.py
from app.tasks.metrics_analyzer import MetricsAnalyzer

@app.on_event("startup")
async def startup_event():
    # Start metrics analyzer
    analyzer = MetricsAnalyzer(
        prometheus_url=settings.prometheus_url,
        anomaly_detector=anomaly_detector
    )
    analyzer.start()
```

## Step 4: Test Integration

### 1. Generate Load

```bash
# Backend load
for i in {1..100}; do
  curl http://localhost:3000/api/v1/health &
done

# Check metrics
curl http://localhost:3000/metrics | grep http_requests_total
```

### 2. Verify Prometheus Scraping

```bash
# Check targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job | startswith("aegis"))'

# Query metrics
curl 'http://localhost:9090/api/v1/query?query=http_requests_total{service="backend"}'
```

### 3. Test AI Engine Feed

```python
# Test metrics feed
python observability/integration/ai-engine-metrics-feed.py
```

## Step 5: Create Alerts

Edit `observability/prometheus/alerts.yml`:

```yaml
- alert: HighAPIErrorRate
  expr: |
    (rate(http_requests_total{status=~"5.."}[5m]) 
    / rate(http_requests_total[5m])) > 0.05
  for: 5m
  annotations:
    summary: 'API error rate > 5%'
```

## Monitoring Workflow

```
1. Services emit metrics
   ↓
2. Prometheus scrapes every 15s
   ↓
3. Metrics stored in Prometheus
   ↓
4. AI Engine fetches metrics every 5 min
   ↓
5. Anomaly detection runs
   ↓
6. If anomaly detected:
   - Check Policy Engine
   - Trigger Executor if approved
   - Alert administrators
```

## Example: High CPU Detection

```python
# 1. Prometheus collects CPU metrics
node_cpu_seconds_total

# 2. AI Engine fetches via feed
metrics = await feed.fetch_infrastructure_metrics()

# 3. AI detects anomaly
result = await detector.detect(metrics['infrastructure'])
# Result: { is_anomaly: true, severity: 'high', recommended_action: 'scale_up' }

# 4. Check policy
policy = await policy_engine.evaluate('scale_up', context)

# 5. Execute if allowed
if policy['allowed']:
    await executor.scale_deployment(...)
```

## Grafana Dashboard Setup

### Import Dashboard

1. Open Grafana: http://localhost:3001
2. Go to Dashboards → Import
3. Upload `grafana/dashboards/aegis-overview.json`

### Create Custom Panel

```json
{
  "title": "Custom Metric",
  "type": "graph",
  "targets": [
    {
      "expr": "your_promql_query_here",
      "legendFormat": "{{label}}"
    }
  ]
}
```

## Best Practices

### 1. Metric Naming

Use consistent naming:
- `<service>_<component>_<metric>_<unit>`
- Example: `backend_api_requests_total`

### 2. Label Usage

Keep cardinality low:
```typescript
// Good
counter.inc({ status: '200', method: 'GET' });

// Bad (high cardinality)
counter.inc({ user_id: '123456', request_id: 'abc' });
```

### 3. Histogram Buckets

Choose appropriate buckets:
```typescript
// API latency (milliseconds)
buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]

// AI inference (seconds)
buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
```

### 4. Sampling

For high-volume metrics:
```python
import random

if random.random() < 0.1:  # 10% sampling
    metrics_service.track_metric(...)
```

## Debugging

### Check Metrics Endpoint

```bash
# Backend
curl http://localhost:3000/metrics

# AI Engine
curl http://localhost:8000/metrics

# Executor
curl http://localhost:4000/metrics
```

### Verify Scraping

```bash
# Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health == "up")'

# Scrape errors
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health == "down")'
```

### Test Queries

```bash
# Query Prometheus
curl 'http://localhost:9090/api/v1/query?query=up{job="aegis-backend"}'

# Query rate
curl 'http://localhost:9090/api/v1/query?query=rate(http_requests_total[5m])'
```

## Advanced Integration

### Custom Metrics

```typescript
// Backend - Track business metrics
const ordersProcessed = new Counter({
  name: 'orders_processed_total',
  help: 'Total orders processed',
  labelNames: ['status']
});

ordersProcessed.inc({ status: 'success' });
```

```python
# AI Engine - Track model retraining
model_retrain_counter = Counter(
    'ai_model_retraining_total',
    'Total model retraining events',
    ['model_type']
)

model_retrain_counter.labels(model_type='anomaly').inc()
```

### Recording Rules

For expensive queries, create recording rules:

```yaml
# prometheus/recording-rules.yml
groups:
  - name: aegis_recording_rules
    interval: 30s
    rules:
      - record: job:http_requests:rate5m
        expr: sum(rate(http_requests_total[5m])) by (job)
      
      - record: job:http_errors:rate5m
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) by (job)
```

## Performance Considerations

### Cardinality

Monitor metric cardinality:
```bash
curl http://localhost:9090/api/v1/status/tsdb | jq '.data.seriesCountByMetricName'
```

Keep total series < 1 million.

### Query Performance

Use recording rules for:
- Complex aggregations
- High-frequency dashboards
- Alert conditions

### Storage

Monitor Prometheus storage:
```bash
docker exec aegis-prometheus du -sh /prometheus
```

Adjust retention if needed:
```yaml
command:
  - '--storage.tsdb.retention.time=15d'
```

## Complete Example

```python
# ai-engine/app/main.py - Complete integration

from fastapi import FastAPI
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.metrics.ai_engine_metrics import (
    initialize_opentelemetry,
    setup_metrics_endpoint,
    metrics_service
)
from integration.ai_engine_metrics_feed import PrometheusMetricsFeed
from app.services.anomaly_detector import AnomalyDetector
import logging

logger = logging.getLogger(__name__)

app = FastAPI(title="Aegis AI Engine")

# Initialize OpenTelemetry
tracer, meter = initialize_opentelemetry(app)

# Add metrics endpoint
setup_metrics_endpoint(app)

# Prometheus feed
metrics_feed = PrometheusMetricsFeed('http://prometheus:9090')
anomaly_detector = AnomalyDetector()

async def analyze_prometheus_metrics():
    """Scheduled task to analyze Prometheus metrics"""
    logger.info("Fetching metrics from Prometheus")
    
    try:
        # Fetch all metrics
        metrics = await metrics_feed.get_metrics_for_anomaly_detection(
            duration_minutes=60
        )
        
        # Analyze each category
        for category, category_metrics in metrics.items():
            if not category_metrics:
                continue
            
            logger.info(f"Analyzing {len(category_metrics)} {category} metrics")
            
            # Run detection
            result = await anomaly_detector.detect(category_metrics)
            
            if result['is_anomaly'] and result['severity'] in ['high', 'critical']:
                logger.warning(
                    f"Anomaly in {category}: "
                    f"severity={result['severity']}, "
                    f"action={result['recommended_action']}"
                )
                
                # Trigger remediation workflow
                await handle_anomaly(category, result)
    
    except Exception as e:
        logger.error(f"Metrics analysis failed: {e}")

async def handle_anomaly(category: str, anomaly: dict):
    """Handle detected anomaly"""
    # Check with Policy Engine
    # Execute remediation if approved
    # Log to audit trail
    pass

# Scheduler
scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def startup():
    # Schedule metrics analysis every 5 minutes
    scheduler.add_job(
        analyze_prometheus_metrics,
        'interval',
        minutes=5,
        id='prometheus_metrics_analysis'
    )
    scheduler.start()
    logger.info("Metrics analyzer started")

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
    await metrics_feed.close()
```

## Testing

```bash
# 1. Start observability stack
cd observability && docker-compose up -d

# 2. Start application services with metrics
cd ../backend && npm run start:dev
cd ../ai-engine && uvicorn app.main:app --reload
cd ../executor && npm run start:dev

# 3. Generate load
for i in {1..1000}; do curl http://localhost:3000/api/v1/health; done

# 4. Check Prometheus
open http://localhost:9090/graph

# 5. Check Grafana
open http://localhost:3001

# 6. Verify AI Engine is analyzing
curl http://localhost:8000/api/v1/metrics/predictions | jq '.predictions | length'
```

## Troubleshooting

### Metrics Not Scraped

```bash
# Check service metrics endpoint
curl http://localhost:3000/metrics

# Check Prometheus config
docker exec aegis-prometheus cat /etc/prometheus/prometheus.yml

# Check Prometheus logs
docker logs aegis-prometheus

# Check targets status
open http://localhost:9090/targets
```

### High Memory Usage

```bash
# Check Prometheus memory
docker stats aegis-prometheus

# Reduce retention
# Edit prometheus.yml: --storage.tsdb.retention.time=15d

# Restart
docker-compose restart prometheus
```

## Next Steps

1. Create custom Grafana dashboards
2. Configure alert routing (Slack, PagerDuty)
3. Set up SLO tracking
4. Document runbooks for alerts
5. Train team on observability tools
6. Set up long-term storage (Thanos, Cortex)

## Resources

- Full documentation: [README.md](README.md)
- Log format spec: [loki/log-format-spec.md](loki/log-format-spec.md)
- Instrumentation code: `instrumentation/`
- Integration examples: `examples/`
