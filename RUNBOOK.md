# Aegis Operations Runbook

---

## 1. What This Runbook Is For

**Scope**: This runbook covers deployment, health checks, common operational tasks, incident response, and safe shutdown for the Aegis platform (backend, AI engine, executor, frontend, and supporting infra). It is written for SREs, platform engineers, and on-call engineers who need to run, verify, or recover Aegis.

**Covers**:
- Local deployment (Docker Compose)
- Staging/production deployment (Kubernetes)
- Health checks and verification
- Restarting, scaling, rotating secrets, updating policies, disabling executor
- Incident response for backend down, AI bad predictions, executor misbehavior, DB issues
- Alerts and monitoring
- Disaster recovery (backups, restore)
- Security incidents (credential leak, suspicious executor activity, policy tampering)
- Safe shutdown

**Does not cover**:
- Application development or code changes
- Deep debugging of business logic (use ARCHITECTURE.md and code)
- Kubernetes cluster provisioning or node management
- Network or cloud provider outages (only Aegis components)

---

## 2. System Prerequisites

**Kubernetes cluster requirements**:
- Kubernetes 1.24+ (or compatible)
- Ingress controller (e.g. ingress-nginx) if exposing via ingress
- StorageClass for PersistentVolumes if using stateful Postgres/Redis in cluster
- DNS or /etc/hosts for ingress hostnames

**Required namespaces**:
- `aegis` (or name from k8s/namespace.yaml / overlays)
- Optional: `ingress-nginx`, `kube-system` for DNS/ingress

**Required secrets** (see k8s/secrets.yaml; operator must replace placeholders):
- **Backend**: `aegis-backend-secrets` — DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, REDIS_PASSWORD
- **AI engine**: `aegis-ai-engine-secrets` — AI_DB_PASSWORD, API_KEY, REDIS_PASSWORD (if used)
- **Executor**: `aegis-executor-secrets` — DB credentials, JWT_SECRET (used as HMAC secret), K8s kubeconfig or in-cluster SA

**Required permissions**:
- `kubectl` access to the target namespace(s)
- Ability to create Secrets, Deployments, Services, ConfigMaps, NetworkPolicies
- Executor service account must have RBAC (Role + RoleBinding) for allowed namespaces (pods get/list/delete, deployments get/list/patch/update)

---

## 3. Deployment

### 3.1 Local (Docker Compose)

**Commands** (from repo root):

```bash
# Backend + frontend + Postgres + Redis (prod-like images)
docker compose -f backend/docker-compose.prod.yml -p aegis up -d

# Optional: pass env file for JWT/DB overrides
docker compose -f backend/docker-compose.prod.yml -p aegis --env-file backend/.env up -d
```

**Expected health checks**:
- Postgres: `pg_isready -U aegis_user -d aegis_db`
- Redis: `redis-cli ping`
- Backend API: HTTP GET to `/api/v1/health/ping` returns 200
- Frontend: no health check in compose (container shows "Up" only)

**Verification**:
- Backend: `curl http://localhost:3000/api/v1/health/ping`
- Frontend: open http://localhost:3001
- Host ports (if mapped): `REDIS_HOST_PORT` default 16379, `POSTGRES_HOST_PORT` default 15432

**AI engine / Executor** (optional, separate):
- AI engine: `docker compose -f ai-engine/docker-compose.yml -p aegis-ai up -d` (from repo root)
- Executor: requires K8s or executor’s own compose; see executor/README.md

### 3.2 Staging / Production (Kubernetes)

**Apply order**:
1. Namespace and (if used) CRDs
2. Secrets (replace placeholders; use Sealed Secrets or External Secrets if required)
3. ConfigMaps
4. Postgres/Redis (if in-cluster) or ensure external DB/Redis are reachable
5. Backend, AI engine, Executor deployments and services
6. Frontend deployment and service (if frontend is in same cluster)
7. Ingress (if used)
8. Network policies (default deny; then allow rules)

**Commands** (example with Kustomize):

```bash
# Staging
kubectl apply -k k8s/overlays/staging

# Production
kubectl apply -k k8s/overlays/production
```

**Verification**:
- Pods: `kubectl -n aegis get pods` — all Running (or Completed for jobs)
- Services: `kubectl -n aegis get svc`
- Backend health: `kubectl -n aegis port-forward svc/backend 3000:3000` then `curl http://localhost:3000/api/v1/health/ping`
- Ingress: `curl -H "Host: <ingress-host>" https://<ingress-ip>/api/v1/health/ping`

**Rollback**:
- Deployment: `kubectl -n aegis rollout undo deployment/<deployment-name>`
- Full rollback: revert Kustomize/ manifests and re-apply, or `kubectl apply -k k8s/overlays/<env>` with previous commit
- No automated rollback in application code; operator-driven

---

## 4. Health Checks & Verification

| Component       | Endpoint / Check | Expected |
|----------------|------------------|----------|
| Backend        | GET /api/v1/health | 200; database, redis, aiEngine up |
| Backend        | GET /api/v1/health/ping | 200; status ok, uptime |
| AI engine      | GET /health      | 200 (FastAPI) |
| Executor       | GET /health or /api/health | 200 (see executor code) |
| Frontend       | GET / (browser or curl) | 200 or 307 redirect |
| Postgres       | pg_isready       | Exit 0 |
| Redis          | redis-cli ping   | PONG |
| Prometheus     | GET /-/healthy   | 200 |
| Grafana        | GET /api/health  | 200 |
| Loki           | GET /ready       | 200 |

**Backend** depends on DB and Redis; if AI_ENGINE_URL is set, health also checks AI engine. If AI engine is down, backend health fails unless health check is changed to optional for AI.

---

## 5. Common Operational Tasks

**Restarting services**:
- **Compose**: `docker compose -f backend/docker-compose.prod.yml -p aegis restart api` (or `frontend`, `postgres`, `redis`)
- **K8s**: `kubectl -n aegis rollout restart deployment/backend` (or ai-engine, executor, frontend)

**Scaling backend**:
- **K8s**: `kubectl -n aegis scale deployment/backend --replicas=3` (or edit deployment/HPA)
- **Compose**: single replica by default; scale by running more compose stacks or use Swarm

**Rotating secrets**:
- **Compose**: Update backend/.env (or env file); restart api: `docker compose -f backend/docker-compose.prod.yml -p aegis up -d api`
- **K8s**: Update Secret (e.g. `kubectl edit secret aegis-backend-secrets -n aegis` or re-apply sealed secret); restart pods to pick up new secret: `kubectl -n aegis rollout restart deployment/backend`
- **JWT rotation**: Change JWT_SECRET and JWT_REFRESH_SECRET; all existing tokens invalidated; users must re-login. **Executor HMAC**: If executor uses JWT_SECRET for HMAC, rotate with JWT; if EXECUTOR_HMAC_SECRET is used, rotate it and update backend and executor together.

**Updating policies**:
- Via API: PUT /api/v1/policy/:id (authenticated, admin/role required)
- Via frontend: Policies page → edit → save
- No git-based policy sync in repo; policy state is in DB

**Disabling executor actions**:
- **Immediate**: Scale executor to 0: `kubectl -n aegis scale deployment/executor --replicas=0`. No new actions will run. Existing in-flight requests may complete.
- **Policy**: Change policies to DENY all executor actions for the relevant roles/resources so that even if executor is called, backend returns DENY (executor is not called by backend for denied requests; if something else calls executor, scaling to 0 is the hard stop).
- **Audit**: Query action_audit_logs (backend or executor DB) for recent executions.

---

## 6. Incident Response

### Backend Down

**Symptoms**: 5xx or timeouts on API; health endpoint unreachable; frontend cannot load data.

**Steps**:
1. Check pods: `kubectl -n aegis get pods -l app.kubernetes.io/name=backend` (or `docker compose -p aegis ps` for api).
2. Check logs: `kubectl -n aegis logs -l app.kubernetes.io/name=backend --tail=200` (or `docker compose -p aegis logs api --tail=200`).
3. Check dependencies: Postgres and Redis must be up; if backend health checks AI engine, AI engine down can fail health.
4. Restart: `kubectl -n aegis rollout restart deployment/backend` or `docker compose -f backend/docker-compose.prod.yml -p aegis restart api`.
5. If DB connection fails: verify DB_PASSWORD and DB_HOST/port; check Postgres logs and connectivity (e.g. `kubectl -n aegis run -it --rm debug --image=postgres:16-alpine -- psql -h <postgres-svc> -U aegis_user -d aegis_db`).

**Validation**: `curl http://<backend>/api/v1/health/ping` returns 200.

### AI Engine Producing Bad Predictions

**How to detect**: Alerts or dashboards show anomalous severity or wrong recommendations; operators report false positives/negatives.

**How to disable AI-driven actions**:
- **Policy**: Set policies to DENY automated executor actions for the affected resources/roles so that recommendations do not result in execution.
- **Backend**: Optionally stop calling AI engine (e.g. feature flag or config that skips predict calls); then no new predictions are stored. Existing UI may still show old predictions.
- **Executor**: Scaling executor to 0 stops all execution regardless of policy (see “Disabling executor actions” above).

**Fallback mode**: Backend can continue to serve policy, alerts, and logs without AI; inference is optional. If backend health check includes AI engine and AI is down, health fails unless the check is made optional.

### Executor Misbehavior

**How to immediately stop actions**:
- Scale executor to 0: `kubectl -n aegis scale deployment/executor --replicas=0`. This stops all new executions. In-flight requests may complete.

**How to audit past executions**:
- Query executor DB (or backend DB if in-process executor was used): table `action_audit_logs` (or equivalent). Columns: id, action_type, namespace, resource_name, status, result/error, requested_by, created_at. Use SQL or Grafana/Loki if logs are exported.
- Backend policy audit logs: table `policy_audit_logs` for evaluate calls (who requested what and ALLOW/DENY).

### Database Issues

**Postgres**:
- **Symptoms**: Backend health fails with DB error; 503 or connection errors.
- **Steps**: Check Postgres pods/containers and logs; verify credentials and network (e.g. NetworkPolicy allows backend → postgres). Check disk and PVC. Restart Postgres only if necessary; prefer fixing connectivity or config first.
- **Backup/restore**: See Section 8. infrastructure/scripts/backup.sh and restore.sh exist; operator must configure BACKUP_DIR, credentials, and retention.

**Redis**:
- **Symptoms**: Backend health fails with Redis error; rate limiting may fail open (all requests allowed when Redis is down).
- **Steps**: Check Redis pods/containers and logs; verify REDIS_HOST/PORT and password; check memory/eviction. Restart Redis if needed; data may be lost if not persisted (Redis AOF/RDB is deployment-dependent).

**Loki**:
- **Symptoms**: Log queries or Grafana Loki datasource fail.
- **Steps**: Check Loki deployment and storage; verify Grafana datasource URL and auth. Loki is for observability only; application audit logs are in Postgres.

---

## 7. Alerts & Monitoring

**Key alerts** (see observability/prometheus/alerts.yml):
- High API error rate (5xx)
- High API latency (e.g. P99)
- High rate limit hits
- High AI inference latency
- Executor action failures (if exposed as metrics)

**False positive handling**: Tune thresholds (e.g. error rate, latency) in alerts.yml to avoid noise; use `for` to require sustained condition before firing.

**Alert fatigue mitigation**: Route critical alerts to PagerDuty/Slack; keep warning-level alerts in a separate channel or dashboard; review and adjust thresholds periodically.

**Dashboards**: Grafana dashboards (observability/grafana), e.g. aegis-overview.json; provision via Grafana provisioning. Backend and frontend also expose metrics (e.g. /metrics) for Prometheus scrape.

---

## 8. Disaster Recovery

**Backups**: infrastructure/scripts/backup.sh backs up Postgres (backend and optionally AI/executor DBs) and Redis. Configure BACKUP_DIR, credentials (e.g. BACKEND_DB_PASSWORD), and RETENTION_DAYS. Optional encryption via BACKUP_ENCRYPTION_KEY. Run via cron or scheduler.

**Restore**: infrastructure/scripts/restore.sh restores from backup. Operator must configure paths and credentials. Restore order: Postgres first, then Redis if needed. After restore, restart backend (and executor if it uses its own DB).

**RTO/RPO assumptions**: Not formally defined in repo. Typical goals: RPO (data loss) minutes to hours depending on backup frequency; RTO (recovery time) minutes to hours depending on restore procedure and validation. Operator should define and test.

---

## 9. Security Incidents

**Suspected credential leak**:
- Rotate affected secrets immediately (JWT_SECRET, JWT_REFRESH_SECRET, DB passwords, Redis password, executor HMAC secret). If executor uses JWT_SECRET for HMAC, rotate JWT_SECRET and update backend and executor; invalidate all sessions (users re-login).
- Revoke or rotate any API keys (e.g. AI engine API_KEY if used).
- Check audit logs (policy_audit_logs, action_audit_logs, auth-related audit_events) for suspicious activity (e.g. unexpected evaluate or execute calls, logins from unknown IPs).
- Consider scaling executor to 0 until rotation is complete and verified.

**Suspicious executor activity**:
- Check action_audit_logs for unexpected namespaces, resources, or requestedBy. Scale executor to 0 to stop further actions.
- Verify HMAC secret is not exposed (env, logs, config). Rotate secret and update backend and executor.
- Review network policies and RBAC to ensure only intended callers can reach executor.

**Policy tampering**:
- Review policy_audit_logs and policy CRUD history (if logged). Identify changed policies and revert or fix via API/frontend.
- No cryptographic integrity of policy documents; detection is via audit and comparison. Restore from backup if policy state is in backup and tampering is confirmed.

---

## 10. Known Operational Gaps

- **No runbook automation**: All steps are manual (scripts exist for backup/restore; no automated “runbook execution” or playbooks).
- **No chaos testing**: No documented chaos experiments (e.g. kill pod, disconnect Redis) in repo; operator may run ad-hoc.
- **Manual intervention**: Rollback, secret rotation, and “disable executor” require operator actions; no self-healing of the control plane.
- **Frontend health check**: Disabled in Docker/Compose; no orchestration-level health for frontend container.
- **Single compose “full stack”**: Backend + frontend + Postgres + Redis in one compose; AI engine and executor are separate; no single “start everything” command that includes AI and executor with K8s.

---

## 11. Safe Shutdown Procedure

**Goal**: Stop Aegis without data loss (flush DB, Redis, and graceful shutdown of apps).

**Docker Compose**:
1. Stop traffic (e.g. stop reverse proxy or do not route new requests to aegis).
2. `docker compose -f backend/docker-compose.prod.yml -p aegis stop api frontend` — graceful shutdown of API and frontend (SIGTERM). Wait for exit.
3. Optionally drain Redis (SAVE) if persistence is required: `docker compose -p aegis exec redis redis-cli SAVE`.
4. `docker compose -f backend/docker-compose.prod.yml -p aegis stop postgres redis` — stop Postgres and Redis. Postgres will flush on shutdown; ensure no active connections from api/frontend before stopping.
5. To remove containers (data in volumes persists): `docker compose -f backend/docker-compose.prod.yml -p aegis down`. To remove volumes as well: `docker compose -f backend/docker-compose.prod.yml -p aegis down -v` (destroys DB and Redis data).

**Kubernetes**:
1. Stop ingress or remove routing so no new traffic hits Aegis.
2. Scale deployments to 0: `kubectl -n aegis scale deployment/backend --replicas=0` (and frontend, ai-engine, executor). Wait for pods to terminate.
3. If Postgres/Redis are in-cluster, scale them to 0 after backend is down, or leave them running for data persistence.
4. To delete all resources in namespace: `kubectl delete namespace aegis` (destroys all resources and PVCs depending on reclaim policy). Back up data first if needed.

**Data preservation**: Postgres and Redis data live in volumes (Compose) or PVCs (K8s). Safe shutdown is: stop apps first, then optionally stop DB/Redis after ensuring no writers. Backups should be taken before major changes or shutdown if RPO is required.
