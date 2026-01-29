# Aegis Platform

A production-ready, microservices-based platform for intelligent self-healing infrastructure with AI-powered anomaly detection, policy-driven access control, and safe Kubernetes automation.

## Overview

Aegis is a comprehensive platform that combines machine learning, policy enforcement, and automated remediation to create a self-healing infrastructure system.

### What is Aegis?

Aegis provides:
- **Intelligent Monitoring**: ML-powered anomaly and failure detection
- **Policy-Driven Decisions**: RBAC and condition-based policy evaluation
- **Safe Automation**: Validated, audited Kubernetes operations
- **Complete Audit Trail**: Immutable logs of all decisions and actions

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Aegis Platform                           │
│                                                                │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐         │
│  │  Backend   │◄──►│ AI Engine  │◄──►│  Executor  │         │
│  │  (NestJS)  │    │  (Python)  │    │  (NestJS)  │         │
│  │            │    │            │    │            │         │
│  │ • Auth     │    │ • Anomaly  │    │ • K8s Ops  │         │
│  │ • Policy   │    │ • Failure  │    │ • Audit    │         │
│  │ • RBAC     │    │ • ML       │    │ • Safety   │         │
│  └────────────┘    └────────────┘    └────────────┘         │
│         │                 │                 │                 │
│         └─────────────────┴─────────────────┘                 │
│                           │                                    │
│  ┌────────────────────────▼──────────────────────────┐        │
│  │        PostgreSQL + Redis + Kubernetes           │        │
│  └──────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

## Services

### 🔐 Backend (NestJS) - Port 3000

**Core API with authentication and policy engine**

Features:
- JWT authentication with refresh tokens
- User management with RBAC (admin, user, auditor)
- Policy Engine for access control and self-healing decisions
- Rate limiting and request logging
- Redis caching
- Prometheus metrics export

**Tech**: NestJS, TypeScript, PostgreSQL, Redis

📖 [Backend Documentation](backend/README.md)  
📖 [Policy Engine Documentation](backend/POLICY_ENGINE.md)

### 🤖 AI Engine (Python) - Port 8000

**ML-powered anomaly and failure detection**

Features:
- Anomaly detection with Isolation Forest
- Failure pattern detection with Random Forest
- Feature engineering from metrics and logs
- Severity scoring and action recommendations
- Historical prediction storage
- Prometheus metrics feed integration

**Tech**: Python, FastAPI, scikit-learn, PostgreSQL

📖 [AI Engine Documentation](ai-engine/README.md)  
📖 [AI Engine Quick Start](AI_ENGINE.md)

### ⚙️ Executor (NestJS) - Port 4000

**Safe Kubernetes action execution**

Features:
- Kubernetes operations (restart, scale, rollback)
- HMAC signature validation
- Namespace restrictions and RBAC
- Immutable audit logging to PostgreSQL and Loki
- Rate limiting on critical actions
- Comprehensive action metrics

**Tech**: NestJS, TypeScript, Kubernetes client, PostgreSQL

📖 [Executor Documentation](executor/README.md)  
📖 [Executor Quick Start](EXECUTOR.md)

### 🗄️ Infrastructure (Docker) - Ports 5432-5434, 6379, 3100

**Database and caching infrastructure**

Features:
- 3x PostgreSQL databases (Backend, AI, Executor)
- Redis with TLS encryption
- Loki for centralized logging
- Automated daily backups with encryption
- SSL/TLS on all connections
- Network isolation

**Tech**: PostgreSQL, Redis, Loki

📖 [Infrastructure Documentation](infrastructure/README.md)  
📖 [Infrastructure Quick Start](infrastructure/QUICKSTART.md)

### 📊 Observability (Docker) - Ports 9090, 3001, 3200

**Monitoring, logging, and tracing stack**

Features:
- Prometheus for metrics collection
- Grafana for visualization and dashboards
- Loki for log aggregation
- Tempo for distributed tracing
- OpenTelemetry Collector
- AlertManager with Slack/PagerDuty integration
- AI Engine metrics feed for anomaly detection

**Tech**: Prometheus, Grafana, Loki, Tempo, OpenTelemetry

📖 [Observability Documentation](observability/README.md)  
📖 [Observability Quick Start](OBSERVABILITY.md)

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- Python 3.11+ (for AI Engine)
- kubectl configured (for Executor)
- 4GB+ RAM, 10GB+ disk space

### Start Infrastructure First (5 minutes)

```bash
# 1. Set up databases and cache
cd infrastructure
cp .env.example .env

# IMPORTANT: Edit .env and change ALL passwords
nano .env

# Generate SSL certificates
chmod +x scripts/generate-ssl-certs.sh
./scripts/generate-ssl-certs.sh

# Start infrastructure
docker-compose up -d

# Initialize databases
chmod +x scripts/setup-databases.sh
./scripts/setup-databases.sh

# Test connections
chmod +x scripts/test-connections.sh
./scripts/test-connections.sh

echo "✅ Infrastructure ready!"
```

### Start Observability Stack (2 minutes)

```bash
# 2. Set up monitoring and logging
cd ../observability
cp .env.example .env

# Start observability stack
docker-compose up -d

echo "✅ Observability ready!"
echo "📊 Grafana: http://localhost:3001"
echo "📈 Prometheus: http://localhost:9090"
```

### Start Application Services

```bash
# 3. Backend (API + Policy Engine)
cd ../backend
cp .env.example .env
# IMPORTANT: Edit .env and change JWT_SECRET
docker-compose up -d
echo "✅ Backend running on http://localhost:3000"

# 4. AI Engine
cd ../ai-engine
cp .env.example .env
docker-compose up -d
echo "✅ AI Engine running on http://localhost:8000"

# 5. Executor
cd ../executor
cp .env.example .env
# Configure KUBECONFIG_PATH in .env
docker-compose up -d
echo "✅ Executor running on http://localhost:4000"

# 6. Verify all services
curl http://localhost:3000/api/v1/health
curl http://localhost:8000/health
curl http://localhost:4000/health

# 7. Check metrics collection
curl http://localhost:9090/api/v1/targets
```

## Self-Healing Workflow

### Example: High CPU Triggers Auto-Scaling

```
1. Prometheus collects CPU metrics
   ├─ api-pod-1: CPU 92%
   ├─ api-pod-2: CPU 89%
   └─ api-pod-3: CPU 95%

2. AI Engine analyzes metrics
   POST /api/v1/detect-anomaly
   └─► Result: 
       • is_anomaly: true
       • severity: "high"
       • recommended_action: "scale_up"
       • confidence: 0.91

3. Policy Engine evaluates
   POST /api/v1/policy/evaluate
   └─► Check: Can AI Engine scale in production?
   └─► Match: "Allow Auto-Scale" policy
   └─► Result: ALLOW

4. Executor scales deployment
   POST /executor/execute
   └─► Validate signature ✓
   └─► Check namespace: production ✓
   └─► Execute: scale deployment to 8 replicas
   └─► Log to audit trail

5. Kubernetes applies change
   └─► New pods created
   └─► CPU load distributed
   └─► System stabilizes
```

## API Examples

### Backend: User Authentication

```bash
# Sign up
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Response: { "accessToken": "...", "refreshToken": "..." }
```

### Backend: Policy Evaluation

```bash
curl -X POST http://localhost:3000/api/v1/policy/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "restart_pod",
    "resource": "pod:api-pod",
    "type": "self_healing",
    "context": {
      "userId": "ai-engine",
      "role": "service",
      "metadata": { "severity": "high" }
    }
  }'

# Response: { "allowed": true, "reason": "...", "appliedPolicies": [...] }
```

### AI Engine: Detect Anomaly

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

# Response: { "is_anomaly": true, "severity": "high", ... }
```

### Executor: Execute Action

```bash
curl -X POST http://localhost:4000/executor/execute \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "restart_pod",
    "actionParams": {
      "namespace": "default",
      "podName": "api-pod-12345"
    },
    "requestedBy": "admin"
  }'

# Response: { "success": true, "auditId": "...", "result": {...} }
```

## Project Structure

```
aegis/
├── frontend/             # React/Next.js Dashboard
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # UI components (charts, forms)
│   │   ├── stores/       # Zustand state management
│   │   ├── lib/          # Utils, API client, WebSocket
│   │   └── __tests__/    # Unit tests
│   ├── Dockerfile
│   └── package.json
│
├── backend/              # NestJS API + Policy Engine
│   ├── src/
│   │   ├── auth/         # JWT authentication
│   │   ├── user/         # User management
│   │   ├── policy/       # Policy evaluation engine
│   │   ├── metrics/      # Prometheus metrics
│   │   └── common/       # Shared utilities
│   ├── Dockerfile.production  # Multi-stage prod build
│   └── docker-compose.yml
│
├── ai-engine/            # Python ML service
│   ├── app/
│   │   ├── services/     # ML models
│   │   ├── routers/      # API endpoints
│   │   ├── schemas/      # Data models
│   │   ├── metrics/      # Prometheus metrics
│   │   └── integration/  # Prometheus feed
│   ├── tests/            # Unit tests
│   ├── Dockerfile.production  # Multi-stage prod build
│   └── requirements.txt
│
├── executor/             # Kubernetes executor
│   ├── src/
│   │   ├── executor/     # Action execution
│   │   ├── audit/        # Audit logging
│   │   ├── kubernetes/   # K8s client
│   │   └── metrics/      # Prometheus metrics
│   ├── Dockerfile.production  # Multi-stage prod build
│   └── docker-compose.yml
│
├── infrastructure/       # Databases & Cache (Docker)
│   ├── postgres/         # PostgreSQL schemas
│   ├── redis/            # Redis config
│   ├── loki/             # Loki config
│   ├── scripts/          # Backup/restore scripts
│   └── docker-compose.yml
│
├── observability/        # Monitoring & Tracing (Docker)
│   ├── prometheus/       # Metrics collection
│   ├── grafana/          # Dashboards
│   ├── loki/             # Log aggregation
│   ├── tempo/            # Distributed tracing
│   ├── otel/             # OpenTelemetry
│   ├── instrumentation/  # Service instrumentation
│   └── docker-compose.yml
│
├── k8s/                  # Kubernetes Manifests
│   ├── *.yaml            # Base manifests
│   ├── overlays/
│   │   ├── staging/      # Staging environment
│   │   └── production/   # Production environment
│   ├── cloudflare/       # WAF/DDoS config
│   └── kustomization.yaml
│
├── .github/
│   └── workflows/
│       ├── ci-cd.yaml    # Main CI/CD pipeline
│       └── cloudflare-webhook.yaml
│
├── examples/             # Integration examples
│
├── ARCHITECTURE.md       # System architecture
├── SETUP.md              # Complete setup guide
├── DEPLOYMENT.md         # Production deployment guide
├── OBSERVABILITY.md      # Observability quick start
└── README.md             # This file
```

## Key Features

### 🔒 Security

- **Multi-layer Authentication**: JWT tokens, API keys, HMAC signatures
- **RBAC**: Role-based access control (admin, user, auditor)
- **Policy Engine**: Condition-based access decisions
- **Action Validation**: Namespace restrictions, signature verification
- **Audit Logging**: Immutable logs in PostgreSQL and Loki
- **Non-root Containers**: All services run as non-root users

### 🤖 Intelligence

- **Anomaly Detection**: ML-based detection of unusual patterns
- **Failure Prediction**: Identify issues before they cause outages
- **Root Cause Analysis**: Automated diagnosis of problems
- **Smart Recommendations**: Context-aware remediation actions
- **Continuous Learning**: Historical data for model improvement

### ⚡ Automation

- **Self-Healing**: Automated remediation of detected issues
- **Policy-Driven**: All actions approved by Policy Engine
- **Safe Execution**: Namespace restrictions, rate limiting
- **Audit Trail**: Complete history of all actions
- **Rollback Capability**: Quick recovery from failed changes

## Use Cases

### 1. Automated Scaling

When CPU usage exceeds threshold:
- AI Engine detects anomaly
- Policy Engine approves scale-up
- Executor scales deployment
- System returns to normal

### 2. Pod Recovery

When pod enters CrashLoopBackOff:
- AI Engine detects failure pattern
- Policy Engine checks if restart allowed
- Executor restarts pod
- Issue resolved automatically

### 3. Emergency Rollback

When new deployment causes errors:
- AI Engine detects spike in error rate
- Determines root cause: recent deployment
- Policy Engine approves rollback
- Executor reverts to previous version
- Service stability restored

### 4. Access Control

When user attempts unauthorized action:
- Backend receives API request
- Policy Engine evaluates permissions
- Request denied based on role
- Denial logged to audit trail
- User receives clear error message

## Configuration

### Environment Variables

**Backend**:
```env
JWT_SECRET=change_this
DB_HOST=localhost
REDIS_HOST=localhost
```

**AI Engine**:
```env
ANOMALY_THRESHOLD=0.85
POLICY_ENGINE_URL=http://localhost:3000
```

**Executor**:
```env
ALLOWED_NAMESPACES=default,production
REQUIRE_ACTION_SIGNATURE=true
```

## Monitoring

### Health Checks

```bash
# All services
curl http://localhost:3000/api/v1/health  # Backend
curl http://localhost:8000/health          # AI Engine  
curl http://localhost:4000/health          # Executor
```

### Metrics Endpoints

```bash
# Backend stats
curl http://localhost:3000/api/v1/policy/audit/logs

# AI Engine stats
curl http://localhost:8000/api/v1/metrics/stats

# Executor stats
curl http://localhost:4000/audit/statistics
```

## Testing

```bash
# Backend
cd backend && npm run test

# AI Engine
cd ai-engine && pytest tests/ -v

# Executor
cd executor && npm run test
```

## Deployment

### Development

Use Docker Compose (see Quick Start above)

### Production (Kubernetes)

```bash
# Apply Kubernetes manifests
kubectl apply -f backend/k8s/
kubectl apply -f ai-engine/k8s/
kubectl apply -f executor/k8s/

# Verify deployments
kubectl get pods -l app=aegis
```

## Documentation

- 📘 [Architecture Overview](ARCHITECTURE.md) - System design
- 🎨 [Frontend](frontend/README.md) - React/Next.js dashboard
- 📗 [Backend API](backend/README.md) - Auth + Policy Engine
- 📙 [AI Engine](ai-engine/README.md) - ML models
- 📕 [Executor](executor/README.md) - K8s operations
- 🗄️ [Infrastructure](infrastructure/README.md) - Databases & Cache
- 📊 [Observability](observability/README.md) - Monitoring & Tracing
- ☸️ [Kubernetes](k8s/README.md) - Production K8s manifests
- 🚀 [Deployment](DEPLOYMENT.md) - CI/CD & cloud deployment
- ⚡ [Quick Starts](infrastructure/QUICKSTART.md) - 5-minute setup guides

## Security Notice

⚠️ **Before Production**:

1. Change all default secrets (JWT, database passwords, API keys)
2. Review and customize default policies
3. Configure appropriate rate limits
4. Set up monitoring and alerting
5. Test disaster recovery procedures
6. Review Kubernetes RBAC permissions
7. Enable HTTPS for all services

## Performance

- **Backend**: 1000+ req/s
- **AI Engine**: 100+ inferences/s
- **Executor**: 10+ actions/s (rate limited)
- **Latency**: < 200ms end-to-end

## License

MIT

## Contributing

Contributions welcome! Please:
1. Follow existing code structure
2. Add tests for new features
3. Update documentation
4. Use TypeScript/Python strictly

## Support

For issues:
1. Check service logs
2. Review audit trails
3. Consult service-specific READMEs
4. Open an issue with details

---

**Built **for production reliability**
