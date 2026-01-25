# Aegis Kubernetes Infrastructure

Production-ready Kubernetes manifests for deploying the Aegis platform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Cloudflare (WAF, DDoS)                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                               │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Ingress Controller                         │  │
│  │                   (nginx-ingress + TLS)                       │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                    │                                 │
│       ┌────────────────────────────┼────────────────────────────┐   │
│       │                            │                            │   │
│       ▼                            ▼                            ▼   │
│  ┌──────────┐              ┌──────────────┐              ┌─────────┐│
│  │ Backend  │              │  AI Engine   │              │Executor ││
│  │ (3 pods) │◄────────────►│  (2 pods)    │◄────────────►│(2 pods) ││
│  └────┬─────┘              └──────┬───────┘              └────┬────┘│
│       │                          │                            │     │
│       │     ┌────────────────────┼────────────────────────────┘     │
│       │     │                    │                                  │
│       ▼     ▼                    ▼                                  │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐│
│  │PostgreSQL    │         │PostgreSQL    │         │PostgreSQL    ││
│  │(Backend DB)  │         │(AI DB)       │         │(Executor DB) ││
│  │ StatefulSet  │         │ StatefulSet  │         │ StatefulSet  ││
│  └──────────────┘         └──────────────┘         └──────────────┘│
│                                    │                                │
│                           ┌────────┴────────┐                       │
│                           │     Redis       │                       │
│                           │  (StatefulSet)  │                       │
│                           └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Kubernetes cluster (1.28+)
- kubectl configured
- kustomize (included in kubectl 1.14+)
- Helm (for installing dependencies)

### 1. Install Dependencies

```bash
# Install ingress-nginx
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true
```

### 2. Configure Secrets

```bash
# Copy and edit secrets
cp k8s/secrets.yaml k8s/secrets-production.yaml

# Edit secrets with actual values
# IMPORTANT: Use sealed-secrets or external-secrets in production
nano k8s/secrets-production.yaml
```

### 3. Deploy to Staging

```bash
# Apply staging configuration
kubectl apply -k k8s/overlays/staging

# Check deployment status
kubectl -n aegis-staging get pods -w

# Verify services
kubectl -n aegis-staging get svc
```

### 4. Deploy to Production

```bash
# Apply production configuration
kubectl apply -k k8s/overlays/production

# Check deployment status
kubectl -n aegis get pods -w

# Verify HPA is working
kubectl -n aegis get hpa
```

## Directory Structure

```
k8s/
├── namespace.yaml            # Namespace, ResourceQuota, LimitRange
├── secrets.yaml              # Secrets (use sealed-secrets in prod)
├── configmaps.yaml           # ConfigMaps for all services
├── network-policies.yaml     # Network segmentation policies
│
├── backend-deployment.yaml   # Backend Deployment, Service, HPA, PDB
├── ai-engine-deployment.yaml # AI Engine Deployment, Service, HPA, PDB
├── executor-deployment.yaml  # Executor Deployment, Service, RBAC
│
├── postgres-statefulset.yaml # 3x PostgreSQL StatefulSets
├── redis-statefulset.yaml    # Redis StatefulSet
│
├── ingress.yaml              # Ingress with TLS
├── cronjobs.yaml             # Backup and maintenance CronJobs
│
├── kustomization.yaml        # Base kustomization
│
├── overlays/
│   ├── staging/              # Staging environment overlay
│   │   ├── kustomization.yaml
│   │   └── namespace.yaml
│   │
│   └── production/           # Production environment overlay
│       └── kustomization.yaml
│
├── cloudflare/
│   └── cloudflare-config.yaml  # Cloudflare WAF/DDoS configuration
│
└── README.md
```

## Security Features

### Pod Security

- ✅ **Non-root users**: All pods run as non-root (UID 1000)
- ✅ **Read-only filesystem**: Application containers have read-only root
- ✅ **Dropped capabilities**: All Linux capabilities dropped
- ✅ **Seccomp profiles**: RuntimeDefault seccomp profile
- ✅ **No privilege escalation**: `allowPrivilegeEscalation: false`

### Network Security

- ✅ **Default deny**: All ingress/egress blocked by default
- ✅ **Explicit policies**: Allow only required communication
- ✅ **Database isolation**: Databases only accessible by app pods
- ✅ **DNS only egress**: Pods can only resolve DNS externally

### Resource Management

- ✅ **Resource quotas**: Namespace-level limits
- ✅ **Limit ranges**: Default pod limits
- ✅ **HPA**: Auto-scaling based on CPU/memory
- ✅ **PDB**: Pod disruption budgets for HA

### Secrets Management

- ✅ **Kubernetes Secrets**: Base implementation
- ⚠️ **Production**: Use Sealed Secrets or External Secrets Operator

## Configuration

### Environment-Specific Settings

| Setting | Staging | Production |
|---------|---------|------------|
| Backend replicas | 2 | 5 |
| AI Engine replicas | 1 | 3 |
| Executor replicas | 1 | 3 |
| Backend CPU request | 100m | 500m |
| Backend memory request | 128Mi | 512Mi |
| AI Engine CPU request | 250m | 1000m |
| AI Engine memory request | 512Mi | 2Gi |
| Log level | debug | warn |

### Scaling

The HPA (Horizontal Pod Autoscaler) is configured for:

- **Backend**: 3-10 pods, scales at 70% CPU
- **AI Engine**: 2-6 pods, scales at 70% CPU
- **Executor**: Fixed 2-3 pods (limited by RBAC)

Manual scaling:

```bash
# Scale backend
kubectl -n aegis scale deployment/backend --replicas=10

# Check HPA status
kubectl -n aegis get hpa
```

### Database Storage

| Database | Storage Class | Size |
|----------|---------------|------|
| PostgreSQL Backend | standard | 20Gi |
| PostgreSQL AI | standard | 50Gi |
| PostgreSQL Executor | standard | 10Gi |
| Redis | standard | 5Gi |

## CronJobs

### Database Backup

- **Schedule**: Daily at 2 AM UTC
- **Retention**: 7 days local, optional S3 upload
- **Databases**: Backend, AI, Executor

```bash
# Manual backup trigger
kubectl -n aegis create job --from=cronjob/database-backup manual-backup-$(date +%Y%m%d)

# Check backup logs
kubectl -n aegis logs job/manual-backup-20240125
```

### Metrics Cleanup

- **Schedule**: Daily at 3 AM UTC
- **Retention**: 30 days predictions, 90 days audit logs

### AI Model Retraining

- **Schedule**: Weekly on Sunday at 4 AM UTC
- **Resources**: 4 CPU, 8Gi memory

## Ingress Configuration

### TLS

Uses cert-manager for automatic TLS certificate management:

```yaml
annotations:
  cert-manager.io/cluster-issuer: "letsencrypt-prod"
```

### Rate Limiting

```yaml
annotations:
  nginx.ingress.kubernetes.io/limit-rps: "100"
  nginx.ingress.kubernetes.io/limit-connections: "50"
```

### Security Headers

All responses include:
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Content-Security-Policy

## Cloudflare Integration

### WAF Rules

- Path traversal protection
- XSS protection
- SQL injection protection
- Bot management
- Challenge suspicious requests (threat score > 30)

### Rate Limiting

- API: 100 req/min per IP
- Login: 10 req/min per IP
- Signup: 5 req/hour per IP

### DDoS Protection

- High sensitivity level
- Block mode enabled
- Auto-mitigation

## Monitoring Integration

Pods are annotated for Prometheus scraping:

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3000"
  prometheus.io/path: "/metrics"
```

## CI/CD Integration

### GitHub Actions

The CI/CD pipeline:

1. **Lint & Test**: Run tests on all services
2. **Security Scan**: Trivy + Snyk scanning
3. **Build & Push**: Multi-stage Docker builds
4. **Deploy Staging**: Auto-deploy to staging on `develop` branch
5. **Deploy Production**: Deploy on version tags (`v*`)
6. **Rollback**: Automatic rollback on failure

### Deployment Flow

```
Push to develop → Tests → Build → Deploy Staging
Push tag v1.0.0 → Tests → Build → Deploy Production → Purge Cloudflare Cache
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl -n aegis describe pod <pod-name>

# Check events
kubectl -n aegis get events --sort-by=.metadata.creationTimestamp

# Check logs
kubectl -n aegis logs <pod-name> --previous
```

### Network Issues

```bash
# Test network policy
kubectl -n aegis run test --image=busybox --rm -it -- wget -O- http://backend:3000/health

# Check DNS
kubectl -n aegis run test --image=busybox --rm -it -- nslookup backend
```

### Database Connection Issues

```bash
# Check PostgreSQL status
kubectl -n aegis exec -it postgres-backend-0 -- pg_isready

# Check connection from app pod
kubectl -n aegis exec -it <backend-pod> -- nc -zv postgres-backend 5432
```

### Scaling Issues

```bash
# Check HPA
kubectl -n aegis describe hpa backend-hpa

# Check metrics
kubectl top pods -n aegis
```

## Production Checklist

- [ ] Replace placeholder secrets with real values
- [ ] Configure sealed-secrets or external-secrets
- [ ] Set up cert-manager ClusterIssuer
- [ ] Configure backup S3 bucket
- [ ] Set up monitoring (Prometheus, Grafana)
- [ ] Configure Cloudflare WAF rules
- [ ] Test disaster recovery
- [ ] Configure PagerDuty/Slack alerts
- [ ] Review and tune resource limits
- [ ] Enable cluster autoscaler
- [ ] Set up log aggregation
- [ ] Document runbooks

## Commands Reference

```bash
# Deploy
kubectl apply -k k8s/overlays/production

# Check status
kubectl -n aegis get all

# View logs
kubectl -n aegis logs -l app.kubernetes.io/name=backend -f

# Scale
kubectl -n aegis scale deployment/backend --replicas=10

# Rollback
kubectl -n aegis rollout undo deployment/backend

# Port forward for debugging
kubectl -n aegis port-forward svc/backend 3000:3000

# Get shell in pod
kubectl -n aegis exec -it <pod-name> -- /bin/sh
```

## Support

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kustomize](https://kustomize.io/)
- [Cloudflare Documentation](https://developers.cloudflare.com/)
