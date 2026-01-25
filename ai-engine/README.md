# Aegis AI Engine

AI-powered anomaly detection and self-healing engine for the Aegis platform. This service uses machine learning to analyze system metrics and logs, detect anomalies, identify failure patterns, and recommend remediation actions.

## Features

### 🔍 Anomaly Detection
- Real-time detection of unusual patterns in API usage metrics
- Statistical and machine learning-based approaches (Isolation Forest)
- Severity scoring (Low, Medium, High, Critical)
- Automated remediation recommendations

### 🛠️ Failure Pattern Detection
- Analysis of logs and metrics for failure prediction
- Root cause analysis
- Multiple failure type detection (service down, high latency, memory leaks, timeouts)
- Self-healing action recommendations

### 📊 Data Processing
- Comprehensive preprocessing pipeline for metrics and logs
- Feature engineering (statistical, trend, rate-of-change)
- Keyword extraction from logs
- Data normalization and scaling

### 🔒 Security
- Runs as non-root user in Docker
- API key authentication
- Read-only database access for metrics
- Isolated execution environment

## Architecture

```
ai-engine/
├── app/
│   ├── models/              # Database models
│   ├── routers/             # API endpoints
│   ├── schemas/             # Pydantic schemas
│   ├── services/            # ML models and processing
│   ├── config.py            # Configuration
│   └── main.py              # FastAPI application
├── tests/                   # Unit tests
├── Dockerfile               # Multi-stage Docker build
├── requirements.txt         # Python dependencies
└── README.md                # This file
```

## Quick Start

### Local Development

1. **Install dependencies**:
```bash
cd ai-engine
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Set up environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Run the service**:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

4. **Access the API**:
- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### Docker Deployment

1. **Build the image**:
```bash
docker build -t aegis-ai-engine .
```

2. **Run the container**:
```bash
docker run -p 8000:8000 --env-file .env aegis-ai-engine
```

## API Endpoints

### Health & Status

**GET** `/health`
- Health check with model and database status

**GET** `/ping`
- Simple ping endpoint

### Inference

**POST** `/api/v1/detect-anomaly`
- Detect anomalies in metrics
- Returns: anomaly score, severity, recommended action

**POST** `/api/v1/detect-failure`
- Detect failure patterns from metrics and logs
- Returns: failure type, root cause, remediation actions

### Metrics

**GET** `/api/v1/metrics/predictions`
- Historical prediction data

**GET** `/api/v1/metrics/model-performance`
- Model performance metrics

**GET** `/api/v1/metrics/stats`
- Overall statistics

## Usage Examples

### Anomaly Detection

```python
import requests

url = "http://localhost:8000/api/v1/detect-anomaly"
headers = {"X-API-Key": "your_api_key_here"}

payload = {
    "metrics": [
        {
            "metric_type": "cpu_usage",
            "value": 95.5,
            "timestamp": "2024-01-25T10:00:00Z",
            "labels": {"pod": "api-1"}
        },
        {
            "metric_type": "memory_usage",
            "value": 88.3,
            "timestamp": "2024-01-25T10:00:00Z",
            "labels": {"pod": "api-1"}
        }
    ]
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

Response:
```json
{
  "is_anomaly": true,
  "anomaly_score": 0.87,
  "severity": "high",
  "recommended_action": "scale_up",
  "confidence": 0.92,
  "affected_metrics": ["cpu_usage", "memory_usage"],
  "details": {
    "anomaly_score": 0.87,
    "affected_features": ["cpu_usage_mean", "memory_usage_max"],
    "model_confidence": 0.92
  },
  "timestamp": "2024-01-25T10:00:01Z"
}
```

### Failure Detection

```python
url = "http://localhost:8000/api/v1/detect-failure"

payload = {
    "metrics": [
        {
            "metric_type": "error_rate",
            "value": 0.35,
            "timestamp": "2024-01-25T10:00:00Z",
            "labels": {"service": "api"}
        }
    ],
    "logs": [
        {
            "timestamp": "2024-01-25T10:00:00Z",
            "level": "error",
            "message": "Connection timeout to database",
            "service": "api-service"
        },
        {
            "timestamp": "2024-01-25T10:00:01Z",
            "level": "error",
            "message": "Failed to connect",
            "service": "api-service"
        }
    ]
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

Response:
```json
{
  "failure_detected": true,
  "failure_type": "connection_timeout",
  "severity": "high",
  "recommended_actions": ["restart_pod", "scale_up"],
  "confidence": 0.85,
  "root_cause": "Multiple timeout errors and Connection failures",
  "affected_services": ["api-service", "worker-service"],
  "details": {
    "confidence": 0.85,
    "heuristic": true
  },
  "timestamp": "2024-01-25T10:00:02Z"
}
```

## ML Models

### Anomaly Detection
- **Algorithm**: Isolation Forest
- **Purpose**: Detect unusual patterns in metrics
- **Features**: Statistical measures (mean, std, min, max, median, trends)
- **Output**: Binary classification + anomaly score

### Failure Detection
- **Algorithm**: Random Forest Classifier (with heuristic fallback)
- **Purpose**: Identify failure patterns
- **Features**: Combined metrics and log analysis
- **Output**: Failure type + recommended actions

## Data Preprocessing

### Metric Features
- Statistical measures (mean, std, min, max, median)
- Rate of change
- Trends (linear regression slope)
- Normalized values

### Log Features
- Error/warning/info counts
- Error rate calculation
- Keyword extraction (timeout, connection, failed, exception)
- Service-level aggregation

## Integration

### With Policy Engine

The AI Engine can integrate with the Policy Engine to check if remediation actions are permitted:

```python
import httpx

async def check_policy(action: str):
    policy_url = "http://policy-engine:3000/api/v1/policy/evaluate"
    
    payload = {
        "action": action,
        "resource": "cluster:production",
        "type": "self_healing",
        "context": {
            "userId": "ai-engine",
            "role": "service",
            "metadata": {
                "severity": "high",
                "automated": True
            }
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(policy_url, json=payload)
        decision = response.json()
        
        return decision["allowed"]
```

### With Prometheus

```python
from prometheus_client import Counter, Histogram

# Track predictions
anomaly_predictions = Counter(
    'ai_engine_anomaly_predictions_total',
    'Total anomaly predictions',
    ['severity']
)

failure_predictions = Counter(
    'ai_engine_failure_predictions_total',
    'Total failure predictions',
    ['failure_type']
)

# Track latency
inference_latency = Histogram(
    'ai_engine_inference_duration_seconds',
    'Inference latency in seconds',
    ['model_type']
)
```

## Testing

Run unit tests:
```bash
pytest tests/ -v
```

Run with coverage:
```bash
pytest tests/ --cov=app --cov-report=html
```

Run specific test:
```bash
pytest tests/test_anomaly_detector.py -v
```

## Configuration

Key configuration options in `.env`:

```env
# Model Configuration
ANOMALY_THRESHOLD=0.85
FAILURE_DETECTION_WINDOW=300
MIN_SAMPLES_FOR_TRAINING=100

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_engine_db

# External Services
PROMETHEUS_URL=http://localhost:9090
LOKI_URL=http://localhost:3100
POLICY_ENGINE_URL=http://localhost:3000/api/v1/policy/evaluate
```

## Performance

- **Anomaly Detection**: ~10-50ms per request
- **Failure Detection**: ~20-80ms per request
- **Throughput**: 100+ requests/second
- **Memory**: ~200-500MB (depending on model size)

## Security Considerations

1. **Non-root User**: Container runs as user `aiengine` (UID 1001)
2. **Read-only**: Database access is read-only for metrics
3. **API Key**: Optional API key authentication
4. **Isolated**: Runs in separate namespace from other services
5. **Health Checks**: Built-in health monitoring

## Troubleshooting

### Models Not Loading
- Check logs for initialization errors
- Verify sufficient memory
- Ensure training data is available

### High Latency
- Increase container resources
- Enable caching
- Reduce feature dimensionality

### False Positives
- Adjust `ANOMALY_THRESHOLD`
- Retrain with more representative data
- Review feature engineering

## Future Enhancements

- [ ] gRPC endpoint support
- [ ] Online learning and model updates
- [ ] Multi-model ensemble
- [ ] Custom alerting rules
- [ ] Integration with more metrics sources
- [ ] Advanced visualization dashboard

## License

MIT

## Support

For issues and questions about the AI Engine, please check the logs and consult the API documentation at `/docs`.
