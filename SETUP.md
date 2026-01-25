# Aegis Platform - Complete Setup Guide

Complete step-by-step guide to set up the entire Aegis platform from scratch.

## Prerequisites

- Docker & Docker Compose
- Node.js 20+
- Python 3.11+
- kubectl (for Executor)
- 8GB+ RAM
- 20GB+ disk space

## Architecture

You'll be setting up:

1. **Infrastructure** (3x PostgreSQL, Redis, Loki)
2. **Observability** (Prometheus, Grafana, Tempo, OpenTelemetry)
3. **Application Services** (Backend, AI Engine, Executor)

## Complete Setup (15 minutes)

### Part 1: Infrastructure (5 minutes)

```bash
cd infrastructure

# 1. Configure
cp .env.example .env
nano .env  # Change ALL passwords!

# 2. Generate SSL certificates
chmod +x scripts/*.sh
./scripts/generate-ssl-certs.sh

# 3. Start infrastructure
docker-compose up -d

# 4. Wait for services (30 seconds)
sleep 30

# 5. Initialize databases
./scripts/setup-databases.sh

# 6. Verify
./scripts/test-connections.sh
```

**Expected Output**:
```
✅ PostgreSQL Backend is ready
✅ PostgreSQL AI is ready
✅ PostgreSQL Executor is ready
✅ Redis connection successful
✅ Loki is ready
```

### Part 2: Observability (3 minutes)

```bash
cd ../observability

# 1. Configure
cp .env.example .env
nano .env  # Set Grafana password

# 2. Start observability stack
docker-compose up -d

# 3. Wait for services
sleep 30

# 4. Verify
curl http://localhost:9090/-/healthy  # Prometheus
curl http://localhost:3001/api/health # Grafana
curl http://localhost:3100/ready      # Loki
```

**Access Dashboards**:
- Grafana: http://localhost:3001 (admin/your_password)
- Prometheus: http://localhost:9090

### Part 3: Backend Service (3 minutes)

```bash
cd ../backend

# 1. Install dependencies
npm install

# 2. Configure
cp .env.example .env
nano .env  # Change JWT_SECRET!

# 3. Add metrics instrumentation
cp ../observability/instrumentation/backend-metrics.ts src/metrics/

# 4. Install metrics dependencies
npm install prom-client @opentelemetry/api @opentelemetry/sdk-node \
  @opentelemetry/instrumentation-http @opentelemetry/instrumentation-express \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http

# 5. Start service
docker-compose up -d

# Or run locally
npm run start:dev
```

**Verify**:
```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/metrics  # Prometheus metrics
```

### Part 4: AI Engine (2 minutes)

```bash
cd ../ai-engine

# 1. Install dependencies
pip install -r requirements.txt

# Or use virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. Configure
cp .env.example .env
nano .env

# 3. Add metrics instrumentation
cp ../observability/instrumentation/ai-engine-metrics.py app/metrics/
cp ../observability/integration/ai-engine-metrics-feed.py app/integration/

# 4. Install metrics dependencies
pip install prometheus-client opentelemetry-api opentelemetry-sdk \
  opentelemetry-instrumentation-fastapi opentelemetry-exporter-otlp

# 5. Start service
docker-compose up -d

# Or run locally
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Verify**:
```bash
curl http://localhost:8000/health
curl http://localhost:8000/metrics  # Prometheus metrics
```

### Part 5: Executor (2 minutes)

```bash
cd ../executor

# 1. Install dependencies
npm install

# 2. Configure
cp .env.example .env
nano .env  # Set KUBECONFIG_PATH

# 3. Add metrics instrumentation
cp ../observability/instrumentation/executor-metrics.ts src/metrics/

# 4. Start service
docker-compose up -d

# Or run locally
npm run start:dev
```

**Verify**:
```bash
curl http://localhost:4000/health
curl http://localhost:4000/metrics  # Prometheus metrics
```

## Verification

### 1. Check All Services

```bash
# Infrastructure
docker ps | grep aegis

# Expected running containers:
# - aegis-postgres-backend
# - aegis-postgres-ai
# - aegis-postgres-executor
# - aegis-redis
# - aegis-loki
# - aegis-prometheus
# - aegis-grafana
# - aegis-otel-collector
# - aegis-tempo
```

### 2. Check Health Endpoints

```bash
# Application services
curl http://localhost:3000/api/v1/health  # Backend
curl http://localhost:8000/health          # AI Engine
curl http://localhost:4000/health          # Executor

# Observability services
curl http://localhost:9090/-/healthy       # Prometheus
curl http://localhost:3001/api/health      # Grafana
curl http://localhost:3100/ready           # Loki
```

### 3. Check Metrics Collection

```bash
# Verify Prometheus is scraping
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job | startswith("aegis")) | {job: .labels.job, health: .health}'

# Should show all services as "up"
```

### 4. Check Grafana

```bash
# Open Grafana
open http://localhost:3001

# Login: admin / your_password

# Go to Dashboards → Browse
# Should see: Aegis Platform Overview
```

## Test the Platform

### 1. Create Test User

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@aegis.local",
    "password": "Test123456",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### 2. Test AI Anomaly Detection

```bash
curl -X POST http://localhost:8000/api/v1/detect-anomaly \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev_api_key" \
  -d '{
    "metrics": [
      {
        "metric_type": "cpu_usage",
        "value": 95.0,
        "timestamp": "2024-01-25T14:00:00Z",
        "labels": {"pod": "api-1"}
      }
    ]
  }'
```

### 3. Test Executor (if Kubernetes available)

```bash
curl -X POST http://localhost:4000/executor/execute \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "scale_deployment",
    "actionParams": {
      "namespace": "default",
      "deploymentName": "test-deployment",
      "replicas": 3
    },
    "requestedBy": "admin"
  }'
```

### 4. Generate Load & Check Metrics

```bash
# Generate 100 requests
for i in {1..100}; do
  curl http://localhost:3000/api/v1/health &
done
wait

# Check metrics in Prometheus
open http://localhost:9090/graph
# Query: rate(http_requests_total{service="backend"}[5m])

# Check in Grafana
open http://localhost:3001
# Go to Dashboards → Aegis Overview
```

### 5. View Logs

```bash
# In Grafana, go to Explore
# Select: Loki
# Query: {job="aegis-backend"} | json

# Or via API
curl -G http://localhost:3100/loki/api/v1/query_range \
  --data-urlencode 'query={job="aegis-backend"}' \
  --data-urlencode 'limit=10'
```

## Configuration Summary

### Infrastructure

**Databases**:
- Backend DB: localhost:5432
- AI DB: localhost:5433
- Executor DB: localhost:5434

**Cache**:
- Redis: localhost:6379

**Logs**:
- Loki: localhost:3100

### Observability

**Monitoring**:
- Prometheus: localhost:9090
- Grafana: localhost:3001

**Tracing**:
- Tempo: localhost:3200
- OpenTelemetry: localhost:4317-4318

**Alerts**:
- AlertManager: localhost:9093

### Application Services

**APIs**:
- Backend: localhost:3000
- AI Engine: localhost:8000
- Executor: localhost:4000

## Common Commands

### Start Everything

```bash
# Infrastructure
cd infrastructure && docker-compose up -d

# Observability
cd ../observability && docker-compose up -d

# Backend
cd ../backend && docker-compose up -d

# AI Engine
cd ../ai-engine && docker-compose up -d

# Executor
cd ../executor && docker-compose up -d
```

### Stop Everything

```bash
cd infrastructure && docker-compose down
cd ../observability && docker-compose down
cd ../backend && docker-compose down
cd ../ai-engine && docker-compose down
cd ../executor && docker-compose down
```

### View Logs

```bash
# All infrastructure services
docker-compose -f infrastructure/docker-compose.yml logs -f

# Specific service
docker logs aegis-backend -f

# Application logs
tail -f backend/logs/app.log
```

### Restart Service

```bash
docker-compose restart [service-name]
```

## Troubleshooting

### Services Won't Start

```bash
# Check Docker status
docker ps -a

# Check logs
docker-compose logs [service]

# Check ports
netstat -tulpn | grep -E '3000|4000|5432|6379|8000|9090'
```

### Database Connection Failed

```bash
# Test connection
docker exec aegis-postgres-backend pg_isready

# Check credentials in .env
cat infrastructure/.env

# Reinitialize
cd infrastructure
./scripts/setup-databases.sh
```

### Metrics Not Appearing

```bash
# Check /metrics endpoints
curl http://localhost:3000/metrics
curl http://localhost:8000/metrics
curl http://localhost:4000/metrics

# Check Prometheus targets
open http://localhost:9090/targets

# Check if services are instrumented
grep -r "prom-client" backend/package.json
```

### Out of Memory

```bash
# Check container stats
docker stats

# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory: 8GB

# Or reduce services
docker-compose down grafana tempo  # Non-essential for testing
```

## Production Deployment

### Security Checklist

- [ ] Change all default passwords
- [ ] Use CA-signed SSL certificates
- [ ] Enable authentication on Prometheus/Grafana
- [ ] Configure firewall rules
- [ ] Set up VPN for internal services
- [ ] Enable audit logging
- [ ] Configure backup automation
- [ ] Set up disaster recovery

### Performance Tuning

- [ ] Configure database connection pooling
- [ ] Set appropriate rate limits
- [ ] Tune Prometheus retention
- [ ] Configure log sampling
- [ ] Set up caching policies
- [ ] Optimize database indexes
- [ ] Configure auto-scaling

### Monitoring Setup

- [ ] Import Grafana dashboards
- [ ] Configure AlertManager (Slack, PagerDuty)
- [ ] Set up SLO tracking
- [ ] Create runbooks for alerts
- [ ] Test alert routing
- [ ] Configure on-call rotation

## Next Steps

1. **Seed Initial Data**:
```bash
cd backend
npx ts-node src/policy/scripts/seed-policies.ts
```

2. **Create Admin User**:
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -d '{"email":"admin@aegis.local","password":"Admin123456","firstName":"Admin","lastName":"User"}'
```

3. **Import Grafana Dashboards**:
- Open http://localhost:3001
- Go to Dashboards → Import
- Upload dashboards from `observability/grafana/dashboards/`

4. **Configure Alerts**:
- Edit `observability/alertmanager/config.yml`
- Add Slack webhook
- Restart AlertManager

5. **Test Self-Healing**:
```bash
# Run complete workflow
python examples/end-to-end-workflow.py
```

## Architecture Overview

```
Infrastructure Layer (Port 5432-5434, 6379, 3100)
  ↓
Observability Layer (Port 9090, 3001, 3200, 4317-4318)
  ↓
Application Layer (Port 3000, 4000, 8000)
  ↓
Kubernetes API (for Executor)
```

## Support

- 📘 [Architecture](ARCHITECTURE.md)
- 🗄️ [Infrastructure Guide](infrastructure/README.md)
- 📊 [Observability Guide](observability/README.md)
- 📗 [Backend API](backend/README.md)
- 📙 [AI Engine](ai-engine/README.md)
- 📕 [Executor](executor/README.md)

## Quick Reference

### URLs

- Backend API: http://localhost:3000/api/v1
- AI Engine API: http://localhost:8000/api/v1
- Executor API: http://localhost:4000
- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090
- Loki: http://localhost:3100

### Health Checks

```bash
curl http://localhost:3000/api/v1/health  # Backend
curl http://localhost:8000/health          # AI Engine
curl http://localhost:4000/health          # Executor
curl http://localhost:9090/-/healthy       # Prometheus
curl http://localhost:3001/api/health      # Grafana
```

### Credentials

- Grafana: admin / (your password in observability/.env)
- PostgreSQL: See infrastructure/.env
- Redis: See infrastructure/.env

## Estimated Resource Usage

| Component | CPU | Memory | Disk |
|-----------|-----|--------|------|
| Infrastructure | 10% | 1.5GB | 5GB |
| Observability | 15% | 2GB | 3GB |
| Backend | 5% | 512MB | 100MB |
| AI Engine | 10% | 1GB | 500MB |
| Executor | 5% | 256MB | 100MB |
| **Total** | **45%** | **~6GB** | **~10GB** |

## Success Criteria

✅ All services show "healthy" status  
✅ Prometheus scraping all targets  
✅ Grafana showing metrics in dashboards  
✅ Logs appearing in Loki  
✅ Can create users via API  
✅ AI Engine can detect anomalies  
✅ Executor can execute test actions  

---

**Setup Time**: ~15 minutes  
**Services**: 15+ containers  
**Ready for**: Development and testing  
**Production-ready**: After security configuration
