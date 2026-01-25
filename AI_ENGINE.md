# Aegis AI Engine - Production Guide

AI-powered anomaly detection and self-healing engine for Aegis.

## Quick Start

### Using Docker Compose

```bash
cd ai-engine
docker-compose up -d
```

The AI Engine will be available at `http://localhost:8000`

### Manual Setup

```bash
cd ai-engine
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API Documentation

### Interactive Docs
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Key Endpoints

1. **POST** `/api/v1/detect-anomaly`
   - Detect anomalies in metrics
   - Returns: severity, recommended action, confidence

2. **POST** `/api/v1/detect-failure`
   - Detect failure patterns
   - Returns: failure type, root cause, remediation actions

3. **GET** `/health`
   - Health check

## Example Usage

### Detect Anomaly

```bash
curl -X POST http://localhost:8000/api/v1/detect-anomaly \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev_api_key" \
  -d '{
    "metrics": [
      {
        "metric_type": "cpu_usage",
        "value": 95.0,
        "timestamp": "2024-01-25T10:00:00Z",
        "labels": {"pod": "api-1"}
      }
    ]
  }'
```

### Detect Failure

```bash
curl -X POST http://localhost:8000/api/v1/detect-failure \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev_api_key" \
  -d '{
    "metrics": [
      {
        "metric_type": "error_rate",
        "value": 0.45,
        "timestamp": "2024-01-25T10:00:00Z",
        "labels": {"service": "api"}
      }
    ],
    "logs": [
      {
        "timestamp": "2024-01-25T10:00:00Z",
        "level": "error",
        "message": "Connection timeout",
        "service": "api-service"
      }
    ]
  }'
```

## Integration with Policy Engine

The AI Engine can query the Policy Engine before recommending actions:

```python
# In your application
async def get_remediation_with_policy_check(anomaly_response):
    # Check with Policy Engine
    policy_decision = await check_policy(anomaly_response.recommended_action)
    
    if policy_decision["allowed"]:
        # Execute remediation
        await execute_action(anomaly_response.recommended_action)
    else:
        # Log denial
        logger.warning(f"Action denied by policy: {policy_decision['reason']}")
```

## Configuration

Edit `.env` file:

```env
# Model Tuning
ANOMALY_THRESHOLD=0.85  # Higher = fewer false positives
FAILURE_DETECTION_WINDOW=300  # Time window in seconds
MIN_SAMPLES_FOR_TRAINING=100  # Minimum training samples

# API Security
API_KEY=your_secure_api_key_here
```

## Remediation Actions

The AI Engine can recommend:

- `scale_up` - Increase replicas/resources
- `scale_down` - Decrease replicas/resources
- `restart_pod` - Restart failing pod
- `throttle_api` - Enable rate limiting
- `clear_cache` - Clear cache to free memory
- `alert_admin` - Notify administrators
- `no_action` - Monitor only

## Severity Levels

- `critical` - Immediate action required (score ≥ 0.9)
- `high` - Urgent attention needed (score ≥ 0.7)
- `medium` - Monitor closely (score ≥ 0.5)
- `low` - Normal operation (score < 0.5)

## Performance

- Anomaly Detection: ~10-50ms
- Failure Detection: ~20-80ms
- Throughput: 100+ req/sec
- Memory Usage: ~200-500MB

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=app

# Run specific test
pytest tests/test_anomaly_detector.py -v
```

## Monitoring

The service exposes metrics at `/api/v1/metrics/stats`:

```json
{
  "total_predictions": 15234,
  "predictions_last_24h": 1423,
  "total_anomalies_detected": 45,
  "total_failures_detected": 12
}
```

## Troubleshooting

### High False Positive Rate
- Increase `ANOMALY_THRESHOLD` in .env
- Train with more representative data
- Review feature engineering

### Models Not Loading
- Check logs: `docker logs aegis-ai-engine`
- Verify sufficient memory
- Ensure database is accessible

### Slow Response Times
- Increase container resources
- Check database connection
- Review preprocessing pipeline

## Security

- Runs as non-root user (UID 1001)
- API key authentication
- Read-only database access
- Isolated namespace
- Health monitoring

## Production Checklist

- [ ] Set strong API key
- [ ] Configure proper database credentials
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Enable HTTPS (via reverse proxy)
- [ ] Set appropriate resource limits
- [ ] Configure backup for AI database
- [ ] Test failover scenarios

## Support

For issues:
1. Check logs: `docker logs aegis-ai-engine`
2. Review health endpoint: `curl http://localhost:8000/health`
3. Check API docs: http://localhost:8000/docs
4. Review configuration in `.env`
