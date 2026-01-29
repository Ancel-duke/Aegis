# Aegis Architecture

---

## 1. What Aegis Is (Problem & Purpose)

Aegis is a self-healing infrastructure platform that combines policy-driven access control, ML-based anomaly and failure detection, and safe Kubernetes remediation. It addresses the problem of reacting to infrastructure failures and anomalies in a governed, auditable way: instead of ad-hoc scripts or manual intervention, operators define policies that determine which automated actions are allowed, and an AI engine recommends actions that an executor can perform only after policy evaluation and signature validation.

The real-world problem is twofold: (1) **infrastructure security**—ensuring that automated or user-initiated actions (e.g., scaling, restarts, rollbacks) are allowed only when they match organizational policy (roles, time windows, resource scope); and (2) **self-healing**—detecting anomalies and failure patterns from metrics and logs and executing remediation (restart pod, scale deployment, rollback) when policy permits. Target users are platform teams, SREs, and security teams operating Kubernetes (or similar) who need a single control plane for "who can do what" and "what the system is allowed to do automatically," as well as startups that want a reference architecture for policy + ML + safe execution.

---

## 2. High-Level System Overview

The system is a polyglot microservices stack: a NestJS backend (API, auth, policy engine, in-process executor stub), a Python/FastAPI AI engine (anomaly and failure detection), a standalone NestJS executor (real Kubernetes operations), and a Next.js frontend. Data flows as follows:

- **Monitored infrastructure** (metrics from Prometheus, logs from Loki, or direct API calls) is consumed by the **AI engine**, which runs anomaly (Isolation Forest) and failure (Random Forest) models and returns severity and recommended actions.
- The **backend** is the central API: it handles authentication (JWT + refresh), user and role management, and **policy evaluation**. Callers (including the AI engine or automation) ask "can I do action X on resource Y?" and receive ALLOW/DENY plus audit. The backend also exposes an **in-process executor** that validates HMAC and namespace, writes audit logs, and **simulates** actions (no real K8s); production K8s execution is intended to go through the **standalone executor** service.
- The **standalone executor** (separate NestJS app) performs real Kubernetes operations (restart pod, scale deployment, rollback). It validates HMAC signatures and namespace allowlists, writes immutable audit logs, and calls the Kubernetes API.
- The **frontend** (Next.js 15) gives operators and admins a UI for dashboard metrics, alerts, AI insights, policy CRUD, logs viewer, profile, and settings; it uses Zustand for state and WebSockets for real-time alerts.

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                     Aegis System                              │
                    │                                                               │
  Metrics/Logs      │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
  (Prometheus/Loki)─┼─►│  AI Engine  │───►│   Backend   │◄──►│  Executor   │     │
  or API calls      │  │  (Python)   │    │  (NestJS)   │    │ (NestJS)    │     │
                    │  │  Port 8000  │    │  Port 3000  │    │ Port 4000   │     │
                    │  │             │    │             │    │             │     │
                    │  │ • Anomaly   │    │ • Auth/JWT  │    │ • K8s API   │     │
                    │  │ • Failure   │    │ • Policy    │    │ • HMAC      │     │
                    │  │ • Inference │    │ • Executor  │    │ • Namespace │     │
                    │  └──────┬──────┘    │   (stub)    │    │   allowlist │     │
                    │         │           └──────┬──────┘    └──────┬──────┘     │
                    │         │                  │                  │            │
                    │         │                  │  ┌────────────────┴───────┐   │
                    │         │                  │  │  Frontend (Next.js 15) │   │
                    │         │                  └─►│  Port 3001             │   │
                    │         │                     │  Dashboard, Alerts,   │   │
                    │         │                     │  Policies, Logs, etc. │   │
                    │         │                     └──────────────────────┘   │
                    │         │                                                  │
                    │  ┌──────▼──────┐  ┌─────────────┐  ┌─────────────────┐   │
                    │  │ PostgreSQL │  │    Redis    │  │ Loki / Prometheus│   │
                    │  │ (Backend,  │  │ rate-limit  │  │ (observability)  │   │
                    │  │  AI, Exec) │  │ cache       │  │                  │   │
                    │  └────────────┘  └─────────────┘  └─────────────────┘   │
                    └─────────────────────────────────────────────────────────────┘
```

---

## 3. Core Architectural Principles

- **Zero-trust internal communication**: Services do not assume caller identity; the backend validates JWT for user requests; the executor validates HMAC and (optionally) policy decision context for action requests. There is no mTLS between services today; identity is carried in tokens/signatures.
- **Least privilege execution**: The executor is the only component that talks to the Kubernetes API; it is scoped by namespace allowlist and (in K8s deployment) by RBAC. Policies explicitly allow or deny actions by role, resource, and context.
- **Immutable audit logs**: Policy evaluations and executor actions are written to PostgreSQL (and optionally Loki) with no in-place updates; denials and failures are logged with reason.
- **Failure-aware design**: The backend health check includes DB, Redis, and AI engine reachability; the executor logs failed actions and supports a self-healing report (count of failed actions by type). The AI engine degrades gracefully when models are untrained (returns default/low severity).
- **Deterministic builds**: All services use multi-stage Dockerfiles, pinned base images, and (where present) lockfiles (package-lock.json, requirements.txt) for reproducible builds.
- **Observability-first mindset**: Prometheus metrics, structured logs (Loki-friendly), and (where configured) Tempo tracing and Grafana dashboards are part of the design; health endpoints and metrics endpoints are implemented per service.

---

## 4. Services & Responsibilities

### 4.1 Backend API (NestJS)

**Responsibilities**: Single entrypoint for the control plane: authentication and user management, policy evaluation (API access and self-healing decisions), rate limiting, health checks, alerts CRUD, metrics API, AI proxy (forward predict to AI engine and store results), in-process executor (HMAC + namespace + audit, simulated execution), logs API (query logs from DB), settings, and audit events (auth, policy evaluations).

**Auth model**: JWT access tokens (short-lived, e.g. 15m) and refresh tokens (e.g. 7d); refresh rotation on use; passwords hashed with bcryptjs; auth events (signup, login success/failure, logout) logged to audit. Forgot-password and reset-password flows exist (token in DB, mock mail service).

**Policy engine**: JSON-based policies with conditions (role, resource, action, optional metadata/time); evaluation returns ALLOW/DENY and reason; results are cached in Redis (TTL configurable) and every evaluation is written to `policy_audit_logs`. Used for both API access control and self-healing decisions (e.g. "can service X run action Y?").

**Rate limiting**: Redis-backed, per-IP for unauthenticated and per-user for authenticated; decorator-driven limits per endpoint; on Redis failure the guard allows the request and logs (fail-open).

**Health checks**: `/api/v1/health` runs Terminus checks for PostgreSQL, Redis, and AI engine HTTP ping; `/api/v1/health/ping` returns lightweight ok/uptime.

**COMPLETE**: Auth (signup, login, refresh, logout, forgot/reset password), user CRUD and profile, policy CRUD and evaluate, policy audit logs API, rate limiting, health (DB + Redis + AI engine), alerts CRUD and WebSocket gateway, metrics API (current, historical, policy-evaluation-counts), AI proxy and prediction storage, in-process executor (HMAC, namespace allowlist, audit, simulated action), logs API (GET /api/v1/logs with query params from DB), settings API, audit events (auth, policy). Unit/integration tests for major modules.

**PARTIALLY IMPLEMENTED**: Policy conditions could be extended (e.g. richer time/context); executor in backend is simulation only—real K8s is in standalone executor; metrics "historical" may be stub or partial depending on data source.

**NOT IMPLEMENTED**: mTLS between services; distributed tracing propagation; Loki as direct log source for GET /api/v1/logs (current implementation uses DB-stored logs); rate limit metrics export; OIDC/SSO.

---

### 4.2 AI Engine (Python / FastAPI)

**Purpose**: Anomaly detection on metrics and failure-pattern detection for self-healing recommendations.

**Model**: **Anomaly**: Isolation Forest (sklearn) plus Elliptic Envelope for Gaussian-style anomalies; **Failure**: Random Forest classifier for failure types (e.g. service_down, high_latency, memory_leak, connection_timeout). Preprocessing and feature engineering (e.g. stats, trends) in a dedicated module.

**Inference flow**: Client sends metrics (and optionally log-derived features) via POST; preprocessing builds a feature vector; anomaly model returns is_anomaly, score, severity, recommended action; failure model returns failure_type, severity, recommended actions, confidence. Results can be stored and exposed via metrics.

**Training vs inference**: Models have `train(X)` / `train(X, y)` and `predict(X)`. Training is not exposed over HTTP in the default setup; inference is. If not trained, the code returns safe defaults (e.g. no anomaly, low severity) so the system does not block.

**COMPLETE**: Anomaly detector (Isolation Forest + Elliptic Envelope), failure detector (Random Forest), preprocessing pipeline, FastAPI routers (health, inference, metrics), Prometheus metrics, config and schemas, unit tests.

**PARTIALLY IMPLEMENTED**: Training pipeline and persistence of model state (e.g. joblib) may be local or not wired to a scheduler; integration with Prometheus/Loki for automatic pull of metrics/logs is outlined in docs but may not be fully wired in code.

**NOT IMPLEMENTED**: Online learning; A/B tests of models; GPU acceleration; Python 3.13 is not guaranteed (e.g. some dependencies may have compatibility issues—explicitly a known limitation).

**Python 3.13 compatibility**: The project targets Python 3.11. Dependency/installation issues with Python 3.13 are a known limitation; CI and docs use 3.11. Using 3.11 is recommended.

---

### 4.3 Executor Service

**Why isolated**: The executor is a separate service so that Kubernetes credentials and API access are confined to one process, with a strict allowlist of namespaces and actions. The backend's in-process executor handles policy/audit and signature validation but does not call the cluster; the standalone executor does.

**Kubernetes permissions**: Executor runs with a K8s service account; RBAC is namespace-scoped (e.g. Role + RoleBinding per namespace) with permissions such as pods: get, list, delete and deployments: get, list, patch, update for restart, scale, and rollback.

**Allowed actions**: Restart pod (delete pod in namespace), scale deployment (patch replicas), rollback deployment (patch to previous revision). Action types are enumerated; anything else is rejected.

**HMAC signature validation**: Request payload (actionType, actionParams, requestedBy) is serialized to a canonical JSON form; HMAC-SHA256 with a shared secret is computed and compared to the provided signature (timing-safe compare not explicitly shown; standard string compare in code). Invalid or missing signature results in 403 and audit log. **Note**: The standalone executor uses `JWT_SECRET` from config as the HMAC secret (same env var name as JWT; in production a dedicated `EXECUTOR_HMAC_SECRET` would be preferable).

**Namespace allowlisting**: Only namespaces listed in ALLOWED_NAMESPACES (comma-separated) are accepted; otherwise the request is rejected and logged.

**COMPLETE** (standalone executor in repo): Execute action with HMAC and namespace checks, audit log to PostgreSQL (status, duration, result/error), KubernetesService for restart/scale/rollback, health endpoint, signature generation helper for clients, unit tests.

**PARTIALLY IMPLEMENTED**: Loki sink for audit logs may be documented but not necessarily implemented in code; rate limiting on execute endpoint may be simple or absent; HMAC secret is JWT_SECRET (not a dedicated secret).

**NOT IMPLEMENTED**: mTLS; approval workflows (e.g. two-phase); dry-run mode exposed as API; automatic retries with backoff at executor level.

**Backend in-process executor**: Uses EXECUTOR_HMAC_SECRET (or equivalent), namespace allowlist, immutable audit log, and **simulated** execution only (no K8s API). Used for validation and audit; real execution is via standalone executor.

---

### 4.4 Frontend (Next.js 15)

**Target users**: Operators and admins viewing metrics and alerts, managing policies, inspecting logs and health, and managing profile/settings.

**Main screens**: Dashboard (metrics, charts, policy evaluation counts, alerts summary), Alerts (list, filters, resolve/acknowledge), AI Insights (anomaly list, severity trends), Policies (CRUD, JSON editor, evaluation logs), Logs (filter by level, service, time; pagination), Health (system health, pods, metrics), Profile (user info, password change), Settings, Auth (login, signup, forgot password, reset password).

**State management**: Zustand stores for auth, alerts, metrics, AI insights, policies, logs, settings; no global Redux. Persistence (e.g. auth) via localStorage/cookies as applicable.

**WebSocket**: Connection to backend for real-time alerts (and optionally metrics/events); reconnection and auth (e.g. token in query) implemented.

**COMPLETE**: All listed pages and flows, Zustand stores, API client (axios, JWT attachment), WebSocket hook, responsive layout and accessibility improvements (keyboard, aria, tap targets), error boundaries, tests for critical paths and stores.

**PARTIALLY IMPLEMENTED**: Some charts may expect specific metric shapes (e.g. health page) and use guards/empty data when backend shape differs; WebSocket might not cover every event type; frontend Docker image has **health check disabled** (in-container check was unreliable; container shows "Up" without healthy/unhealthy).

**NOT IMPLEMENTED**: SSO/OIDC login; offline support; full e2e coverage for every flow; accessibility audit and certification.

---

## 5. Data Architecture

- **PostgreSQL**: Primary durable store. **Backend** DB: users, roles, user_roles, policies, policy_audit_logs, audit_events, alerts, prediction_results, action_audit_logs (in-process executor), logs (log entries for GET /api/v1/logs), settings. **AI engine** DB (if used): prediction history, model metrics, training data. **Executor** DB (standalone): action_audit_logs. Separate DBs per service in infra layouts to isolate blast radius and allow different backup/retention.
- **Redis**: Sessions/refresh token state, rate limit counters, and policy decision cache (TTL). Single instance in typical compose; no cluster.
- **Loki**: Log aggregation; queries (e.g. LogQL) for debugging and dashboards. Not all services may push logs to Loki in all setups; backend logs are structured for Loki consumption.
- **Prometheus**: Metrics (request counts, latency, custom business metrics). Each service exposes /metrics or equivalent; Prometheus scrapes. Used for SLOs and alerting.
- **Polyglot justification**: PostgreSQL for consistency and audit; Redis for speed and rate limiting; Loki and Prometheus for observability. This is a deliberate split by concern, not a single-store design.

---

## 6. Security Architecture

- **Authentication & authorization**: Users authenticate via email/password; backend issues JWT access + refresh. Protected routes use JWT guard; role (admin, user, auditor) is used in policy evaluation. API access to policy/evaluate, executor, etc. is authenticated where required; executor standalone accepts HMAC-signed requests (signature is the auth for service-to-service).
- **Policy enforcement**: All sensitive actions (and optionally self-healing decisions) go through the policy engine; DENY wins; results are audited.
- **Service-to-service**: AI engine → backend (HTTP, optional API key); Backend/AI engine → Executor: HMAC on request payload with shared secret. No service mesh or mTLS in current design.
- **HMAC**: Executor (standalone and backend stub) validate HMAC-SHA256; standalone executor uses JWT_SECRET as the HMAC secret (config); backend stub uses EXECUTOR_HMAC_SECRET. Timestamp or nonce can be used to limit replay (executor standalone may use timestamp window if implemented).
- **Kubernetes RBAC**: Executor runs as a service account with minimal namespace-scoped Roles (pods, deployments) as described above.
- **Network policies**: K8s manifests define network policies to restrict pod-to-pod traffic; exact rules are in k8s/network-policies.yaml.
- **Missing**: mTLS between Aegis services; OIDC; secret management (e.g. Vault) beyond env vars; formal threat model document.

---

## 7. Observability & Monitoring

- **Metrics**: Prometheus; each service exposes metrics (HTTP, custom). Backend uses interceptors/terminus; AI engine and executor expose Prometheus client metrics. Alerts and dashboards can be built on these.
- **Logs**: Structured JSON logs; Loki-compatible. Backend logging interceptor and app logs; AI engine and executor log similarly. Loki configs and example LogQL exist in observability/.
- **Traces**: Tempo and OpenTelemetry collector are in observability stack (observability/otel, observability/instrumentation); instrumentation (e.g. backend, AI engine) may be partial or example-only. Not every path is fully traced.
- **Dashboards**: Grafana provisioning and example dashboards (e.g. aegis-overview.json) exist in observability/grafana.
- **Alerting**: Alertmanager config (observability/alertmanager, observability/prometheus/alerts.yml) exists; routing to Slack/PagerDuty is configurable. End-to-end alert-to-action (e.g. alert → policy → executor) is a design goal but may not be fully automated in code.
- **Implemented**: Prometheus scrape, Loki ingest, Grafana datasources and dashboards, Alertmanager, health endpoints. **Planned/partial**: Full distributed tracing, SLO-based alerting, runbooks.

---

## 8. Containerization & Deployment

- **Docker**: Multi-stage Dockerfiles per service (backend, ai-engine, executor, frontend): build stage (deps + build) and runner stage (non-root user, minimal copy). Frontend uses Next.js `output: 'standalone'`. Images are tagged (e.g. aegis/backend:v1.0.0).
- **Non-root**: Runner stage creates a dedicated user (e.g. nextjs, node) and runs the process as that user.
- **Docker Compose**: Used for local and "prod-like" single-host. **backend/docker-compose.prod.yml**: postgres, redis, api, frontend (optional host port overrides REDIS_HOST_PORT, POSTGRES_HOST_PORT). AI engine and executor have their own compose files. No single "run everything" compose; start order is documented.
- **Kubernetes**: k8s/ contains base manifests and overlays (staging, production): deployments (backend, ai-engine, executor), services, configmaps, secrets, ingress, network-policies, postgres-statefulset, redis-statefulset, cronjobs. Kustomize for env-specific config. Executor has service account and RBAC in executor/k8s/.
- **CI/CD**: GitHub Actions (ci-cd.yaml): lint and test per service (backend, ai-engine, executor); build and push images on tag/main; optional deploy step. Frontend may be in same or separate workflow; matrix does not include frontend by default.
- **Rollback**: Kubernetes rollback is manual (kubectl rollout undo) or via GitOps revert; no automated rollback logic in application code.

---

## 9. Failure Modes & Self-Healing Flow

- **Flow**: Detection (metrics/logs) → AI engine (anomaly/failure, severity, recommended action) → Policy evaluation (backend: allow/deny) → Execution (executor: HMAC + namespace + K8s action) → Audit (PostgreSQL, optionally Loki). Human or automation can trigger policy evaluate and executor execute; full closed loop (Prometheus → AI → Backend → Executor → K8s) depends on wiring and scheduling.
- **Recoverable by Aegis**: Pod restarts, deployment scale-up/down, deployment rollback, within namespace allowlist and policy allow. Depends on executor being deployed and K8s credentials valid.
- **Not recovered by Aegis**: Failures outside policy (e.g. denied action), cluster-level outages, network partitions, dependency failures (DB, Redis, AI engine down) that prevent policy or executor from running. No automatic remediation of the Aegis control plane itself.
- **Safety**: Namespace allowlist and RBAC limit scope; HMAC prevents unauthorized executor calls; policy DENY and audit logs prevent unauthorized actions; rate limiting and fail-open behavior (e.g. rate limit on Redis error) are documented. No circuit breaker or bulk-heading in application code beyond standard K8s resource limits.

---

## 10. Current Project Status (Honest)

| Component | Complete | Partial | Missing | Notes |
|-----------|----------|---------|---------|-------|
| Backend auth | ✓ | | | JWT, refresh, forgot/reset password, bcryptjs, audit |
| Backend policy engine | ✓ | | | Evaluate, cache, audit, CRUD |
| Backend rate limiting | ✓ | | | Redis-backed; fail-open on Redis error |
| Backend health | ✓ | | | DB, Redis, AI engine ping |
| Backend logs API | ✓ | | | GET /api/v1/logs from DB; no Loki query API |
| Backend executor (in-process) | ✓ | | | HMAC, namespace, audit, **simulated** action only |
| Backend AI proxy | ✓ | | | Forward predict, store results, retries |
| Backend alerts & WebSocket | ✓ | | | CRUD, gateway, real-time |
| Backend metrics API | ✓ | | | current, historical, policy-evaluation-counts |
| Standalone executor | ✓ | | | Real K8s restart/scale/rollback, HMAC (JWT_SECRET), namespace, audit |
| AI engine anomaly | ✓ | | | Isolation Forest + Elliptic Envelope |
| AI engine failure | ✓ | | | Random Forest, failure types |
| AI engine training | | ✓ | | train() exists; not exposed/scheduled as HTTP job |
| AI engine Python 3.13 | | | ✓ | Use 3.11; dependency issues with 3.13 |
| Frontend (all pages) | ✓ | | | Dashboard, alerts, AI, policies, logs, health, profile, settings, auth |
| Frontend WebSocket | ✓ | | | Alerts; reconnection, auth |
| Frontend Docker health check | | ✓ | | Disabled in compose; in-container check was unreliable |
| Loki integration | | ✓ | | Config and examples; backend logs format; no GET /logs from Loki in backend |
| Tracing (Tempo/OTel) | | ✓ | | Collector and config; instrumentation partial |
| mTLS | | | ✓ | Not implemented |
| Single compose "full stack" | | ✓ | | backend+frontend in one compose; AI + executor separate |
| K8s production deploy | ✓ | | | Manifests and overlays present; secrets and ingress are operator responsibility |
| Executor HMAC secret | | ✓ | | Standalone uses JWT_SECRET; dedicated EXECUTOR_HMAC_SECRET not used |

---

## 11. Known Limitations & Tradeoffs

- **Backend executor is simulated**: Real Kubernetes execution is only in the standalone executor service. The backend executor is for validation, audit, and integration testing without a cluster; production must call the standalone executor (or equivalent) for real actions.
- **No mTLS**: Service-to-service is HTTP with HMAC/tokens; in a high-security environment, mTLS (or mesh) would be recommended.
- **Python 3.13**: AI engine is not guaranteed to run on 3.13; 3.11 is the supported version.
- **Training not automated**: AI models are trained in code but not exposed as a scheduled or on-demand HTTP job; inference-only is the default.
- **Historical metrics**: Backend "historical" metrics may be stub or derived from a single source; rich time-series may require Prometheus or another store.
- **Executor HMAC secret**: Standalone executor uses JWT_SECRET for HMAC; in production a dedicated secret (EXECUTOR_HMAC_SECRET) would improve separation of concerns.
- **Frontend health check**: Disabled in Docker/Compose because node:alpine in-container checks (wget/Node HTTP) were unreliable; container reports "Up" only.
- **Scope**: Aegis is a control plane for policy and execution; it does not replace Prometheus/Loki or Kubernetes—it consumes and acts on them. Some features (e.g. full closed-loop from alert to action) are design goals with partial implementation.

---

## 12. What This Project Demonstrates

- **System design**: Decomposition of policy, detection, and execution into separate services; clear data flow and responsibility boundaries; use of existing building blocks (PostgreSQL, Redis, Prometheus, Loki, K8s).
- **Security thinking**: JWT and refresh rotation, HMAC for executor, namespace allowlisting, RBAC, audit logging, and explicit discussion of what is missing (mTLS, OIDC, dedicated HMAC secret).
- **Production mindset**: Health checks, structured logging, metrics, non-root containers, deterministic builds, and documentation of failure modes and rollback. Honest documentation of disabled or partial features (e.g. frontend health check, executor secret).
- **Tradeoff awareness**: Honest status table and limitations section; distinction between "implemented," "partial," and "missing"; no marking of incomplete work as done. Suitable for review by senior backend engineers, security engineers, and staff/principal engineers evaluating depth and judgment.
