# Aegis Production Deployment Guide

Complete guide for deploying Aegis to Kubernetes with CI/CD and Cloudflare protection.

## Quick Start (10 minutes)

### 1. Build Docker Images

```bash
# Build all services
docker build -f backend/Dockerfile.production -t aegis/backend:v1.0.0 ./backend
docker build -f ai-engine/Dockerfile.production -t aegis/ai-engine:v1.0.0 ./ai-engine
docker build -f executor/Dockerfile.production -t aegis/executor:v1.0.0 ./executor

# Push to registry
docker push aegis/backend:v1.0.0
docker push aegis/ai-engine:v1.0.0
docker push aegis/executor:v1.0.0
```

### 2. Deploy to Kubernetes

```bash
# Configure secrets (IMPORTANT: Edit with real values)
cp k8s/secrets.yaml k8s/my-secrets.yaml
nano k8s/my-secrets.yaml
kubectl apply -f k8s/my-secrets.yaml

# Deploy all resources
kubectl apply -k k8s/overlays/production

# Watch deployment
kubectl -n aegis get pods -w
```

### 3. Verify Deployment

```bash
# Check all pods are running
kubectl -n aegis get pods

# Check services
kubectl -n aegis get svc

# Test health endpoints
kubectl -n aegis port-forward svc/backend 3000:3000 &
curl http://localhost:3000/api/v1/health
```

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      Cloudflare Edge                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │   WAF    │ │  DDoS    │ │Bot Mgmt  │ │   Rate Limit     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
└────────────────────────────┬───────────────────────────────────┘
                             │ HTTPS
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                   Kubernetes Cluster                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Ingress (nginx + TLS)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                    │                    │            │
│         ▼                    ▼                    ▼            │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐      │
│  │  Backend   │      │ AI Engine  │      │  Executor  │      │
│  │  (5 pods)  │◄────►│  (3 pods)  │◄────►│  (3 pods)  │      │
│  │  HPA 3-10  │      │  HPA 2-6   │      │  PDB min 1 │      │
│  └──────┬─────┘      └─────┬──────┘      └─────┬──────┘      │
│         │                  │                   │              │
│  ┌──────▼──────────────────▼───────────────────▼──────┐      │
│  │              Network Policies                       │      │
│  │  (Strict pod-to-pod communication rules)            │      │
│  └────────────────────────────────────────────────────┘      │
│                                                                │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐   │
│  │PostgreSQL │  │PostgreSQL │  │PostgreSQL │  │  Redis  │   │
│  │ Backend   │  │   AI      │  │ Executor  │  │  Cache  │   │
│  │ 20Gi SSD  │  │  50Gi SSD │  │ 10Gi SSD  │  │  5Gi    │   │
│  └───────────┘  └───────────┘  └───────────┘  └─────────┘   │
└────────────────────────────────────────────────────────────────┘
```

## Docker Images

### Multi-Stage Builds

All Dockerfiles use multi-stage builds for:
- Smaller image sizes
- No build tools in production
- Faster deployments
- Better security

### Image Sizes

| Service | Dev Image | Prod Image |
|---------|-----------|------------|
| Backend | ~1.2GB | ~250MB |
| AI Engine | ~2.5GB | ~800MB |
| Executor | ~1.0GB | ~200MB |

### Security Features

- ✅ Non-root users (UID 1000)
- ✅ Read-only root filesystem
- ✅ Health checks included
- ✅ dumb-init for signal handling
- ✅ Minimal base images (Alpine/Slim)

## Kubernetes Resources

### Deployments

| Resource | Replicas | CPU Request | Memory Request | CPU Limit | Memory Limit |
|----------|----------|-------------|----------------|-----------|--------------|
| Backend | 5 | 500m | 512Mi | 2000m | 2Gi |
| AI Engine | 3 | 1000m | 2Gi | 4000m | 8Gi |
| Executor | 3 | 100m | 256Mi | 500m | 512Mi |

### StatefulSets

| Resource | Replicas | Storage | Storage Class |
|----------|----------|---------|---------------|
| PostgreSQL Backend | 1 | 20Gi | standard |
| PostgreSQL AI | 1 | 50Gi | standard |
| PostgreSQL Executor | 1 | 10Gi | standard |
| Redis | 1 | 5Gi | standard |

### Autoscaling

| Service | Min | Max | Scale Up Trigger |
|---------|-----|-----|------------------|
| Backend | 3 | 10 | CPU > 70% |
| AI Engine | 2 | 6 | CPU > 70% |
| Executor | 2 | 3 | Fixed |

## Network Policies

All pods have strict network policies:

```
Default: Deny all ingress/egress

Backend can:
  - Receive from: Ingress, AI Engine, Executor, Prometheus
  - Connect to: PostgreSQL Backend, Redis, Monitoring

AI Engine can:
  - Receive from: Backend, Prometheus
  - Connect to: PostgreSQL AI, Redis, Backend, Executor, Monitoring

Executor can:
  - Receive from: AI Engine, Backend, Prometheus
  - Connect to: PostgreSQL Executor, Backend, Kubernetes API, Monitoring

Databases can:
  - Receive from: Application pods only
  - No egress
```

## CI/CD Pipeline

### Workflow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Commit    │────►│  Lint/Test   │────►│  Security   │
│             │     │              │     │    Scan     │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                    ┌───────────────────────────┘
                    │
                    ▼
              ┌──────────────┐
              │ Build/Push   │
              │   Images     │
              └──────┬───────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
  ┌───────────┐            ┌────────────┐
  │  Staging  │            │ Production │
  │  (auto)   │            │ (tag v*)   │
  │  develop  │            │            │
  └───────────┘            └────────────┘
```

### Triggers

| Branch | Action |
|--------|--------|
| `develop` | Deploy to staging |
| `main` | Build images only |
| `v*` tag | Deploy to production |

### Required Secrets

```yaml
# GitHub Repository Secrets
KUBE_CONFIG_STAGING: base64 encoded kubeconfig
KUBE_CONFIG_PRODUCTION: base64 encoded kubeconfig
CLOUDFLARE_ZONE_ID: Cloudflare zone ID
CLOUDFLARE_API_TOKEN: Cloudflare API token
SLACK_WEBHOOK_URL: Slack webhook for notifications
SNYK_TOKEN: Snyk security scanning token
```

## Cloudflare Integration

### WAF Rules

| Rule | Action |
|------|--------|
| Path traversal (`..`) | Block |
| XSS (`<script`) | Block |
| SQL injection (`UNION SELECT`) | Block |
| Suspicious requests (score > 30) | Challenge |

### Rate Limiting

| Endpoint | Limit | Block Duration |
|----------|-------|----------------|
| `/api/v1/*` | 100/min | 10 min |
| `/api/v1/auth/login` | 10/min | 1 hour |
| `/api/v1/auth/signup` | 5/hour | 24 hours |

### DDoS Protection

- Sensitivity: High
- Mode: Block
- Auto-mitigation enabled

### Webhook Integration

Cloudflare sends security events to GitHub Actions:
- DDoS attacks
- WAF blocks
- Bot management events

## Deployment Commands

### Deploy to Staging

```bash
# Using kubectl
kubectl apply -k k8s/overlays/staging

# Or push to develop branch (CI/CD)
git push origin develop
```

### Deploy to Production

```bash
# Using kubectl
kubectl apply -k k8s/overlays/production

# Or create a version tag (CI/CD)
git tag v1.0.0
git push origin v1.0.0
```

### Rollback

```bash
# Rollback all services
kubectl -n aegis rollout undo deployment/backend
kubectl -n aegis rollout undo deployment/ai-engine
kubectl -n aegis rollout undo deployment/executor

# Or rollback to specific revision
kubectl -n aegis rollout undo deployment/backend --to-revision=2
```

### Scale Manually

```bash
# Scale backend
kubectl -n aegis scale deployment/backend --replicas=10

# Scale AI Engine
kubectl -n aegis scale deployment/ai-engine --replicas=5
```

## Monitoring & Debugging

### Check Status

```bash
# All resources
kubectl -n aegis get all

# Pods with more details
kubectl -n aegis get pods -o wide

# HPA status
kubectl -n aegis get hpa

# PDB status
kubectl -n aegis get pdb
```

### View Logs

```bash
# Backend logs
kubectl -n aegis logs -l app.kubernetes.io/name=backend -f

# AI Engine logs
kubectl -n aegis logs -l app.kubernetes.io/name=ai-engine -f

# Executor logs
kubectl -n aegis logs -l app.kubernetes.io/name=executor -f
```

### Port Forward

```bash
# Backend
kubectl -n aegis port-forward svc/backend 3000:3000

# AI Engine
kubectl -n aegis port-forward svc/ai-engine 8000:8000

# Executor
kubectl -n aegis port-forward svc/executor 4000:4000
```

### Debug Pod

```bash
# Get shell
kubectl -n aegis exec -it <pod-name> -- /bin/sh

# Run debug container
kubectl -n aegis debug <pod-name> --image=busybox --target=<container-name>
```

## Maintenance Tasks

### Database Backup (Manual)

```bash
# Trigger backup job
kubectl -n aegis create job --from=cronjob/database-backup manual-backup-$(date +%Y%m%d)

# Check backup status
kubectl -n aegis logs job/manual-backup-$(date +%Y%m%d)
```

### Database Restore

```bash
# Scale down app pods
kubectl -n aegis scale deployment/backend --replicas=0

# Restore from backup
kubectl -n aegis exec -it postgres-backend-0 -- \
  pg_restore -U postgres -d aegis_backend /backups/backup.dump

# Scale back up
kubectl -n aegis scale deployment/backend --replicas=5
```

### Update Secrets

```bash
# Edit secret
kubectl -n aegis edit secret aegis-backend-secrets

# Restart pods to pick up changes
kubectl -n aegis rollout restart deployment/backend
```

## Production Checklist

### Before Deployment

- [ ] All secrets configured with real values
- [ ] TLS certificates ready (cert-manager)
- [ ] DNS configured pointing to Load Balancer
- [ ] Cloudflare WAF rules configured
- [ ] Monitoring stack deployed (Prometheus/Grafana)
- [ ] Log aggregation configured (Loki)
- [ ] Backup S3 bucket configured
- [ ] PagerDuty/Slack integration configured

### After Deployment

- [ ] Health checks passing
- [ ] HPA working correctly
- [ ] Network policies enforced
- [ ] TLS certificates valid
- [ ] Metrics being collected
- [ ] Logs being aggregated
- [ ] Alerts configured
- [ ] Runbooks documented

### Security Audit

- [ ] Secrets not in git
- [ ] Non-root containers
- [ ] Read-only filesystems
- [ ] Network policies active
- [ ] RBAC properly scoped
- [ ] Vulnerability scan passed
- [ ] Penetration test completed

## Cost Estimation

### Minimum Production Setup

| Resource | Count | vCPU | Memory | Storage |
|----------|-------|------|--------|---------|
| Backend pods | 3 | 1.5 | 1.5Gi | - |
| AI Engine pods | 2 | 2 | 4Gi | - |
| Executor pods | 2 | 0.2 | 0.5Gi | - |
| PostgreSQL | 3 | 1.5 | 3Gi | 80Gi |
| Redis | 1 | 0.5 | 0.5Gi | 5Gi |
| **Total** | 11 | ~6 vCPU | ~10Gi | ~85Gi |

### Recommended Production Setup

| Resource | Count | vCPU | Memory | Storage |
|----------|-------|------|--------|---------|
| Backend pods | 5 | 2.5 | 2.5Gi | - |
| AI Engine pods | 3 | 3 | 6Gi | - |
| Executor pods | 3 | 0.3 | 0.75Gi | - |
| PostgreSQL | 3 | 3 | 6Gi | 80Gi |
| Redis | 1 | 0.5 | 0.5Gi | 5Gi |
| **Total** | 15 | ~10 vCPU | ~16Gi | ~85Gi |

## Support

- [Kubernetes Documentation](k8s/README.md)
- [CI/CD Pipeline](.github/workflows/ci-cd.yaml)
- [Cloudflare Configuration](k8s/cloudflare/cloudflare-config.yaml)
- [Observability Stack](observability/README.md)

---

**Deployment Time**: ~10 minutes  
**Minimum Resources**: 6 vCPU, 10Gi RAM, 85Gi storage  
**Recommended Resources**: 10 vCPU, 16Gi RAM, 85Gi storage
