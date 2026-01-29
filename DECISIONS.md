# Architectural Decisions

---

## ADR-001: Monorepo vs Polyrepo

### Status
Accepted

### Context
- Need to coordinate backend (NestJS), AI engine (Python), executor (NestJS), and frontend (Next.js) with shared docs, infra, and CI.
- Constraints: single team or small org; shared architecture and deployment; no separate release trains per service initially.

### Decision
Use a single monorepo (Aegis) with top-level folders: backend/, ai-engine/, executor/, frontend/, infrastructure/, observability/, k8s/. Shared docs (ARCHITECTURE.md, DEPLOYMENT.md, etc.) at root. CI runs per-service (matrix: backend, ai-engine, executor) from same repo.

### Alternatives Considered
- **Polyrepo**: One repo per service. Rejected: harder to keep docs and k8s/infra in sync; cross-service changes require multiple PRs; no single source of truth for “Aegis” as a product.
- **Nx/Turborepo monorepo**: Rejected: added tooling and convention without clear need at current scale; plain folders and per-service package.json/requirements.txt suffice.

### Consequences
- **Positive**: Single clone, shared history, atomic cross-service changes, one CI pipeline, one place for runbooks and architecture.
- **Negative**: Repo size grows; CI must be careful (only test/build changed services or full matrix); no independent versioning per service (all versioned as one or by tag).

---

## ADR-002: NestJS for Backend

### Status
Accepted

### Context
- Need a backend API with auth, policy engine, rate limiting, health checks, WebSockets, and TypeORM for PostgreSQL.
- Constraints: TypeScript/Node ecosystem; structure for guards, decorators, and modules; production use in mind.

### Decision
Use NestJS for the main backend API (backend/). Use TypeORM for PostgreSQL, NestJS Terminus for health, ThrottlerModule for rate limiting, Passport JWT for auth, and NestJS gateways for WebSockets.

### Alternatives Considered
- **Express/Fastify + manual structure**: Rejected: more boilerplate for guards, DI, and modules; NestJS gives consistent patterns and testability.
- **Go (e.g. Gin/Fiber)**: Rejected: team and existing codebase are TypeScript/Node; polyglot already with Python for AI; adding Go increases stack diversity without clear win for this control-plane API.

### Consequences
- **Positive**: Strong structure, decorators for auth and rate limit, good testability, Terminus health, WebSocket support out of the box.
- **Negative**: NestJS learning curve; framework coupling; some “Nest way” overhead for very simple endpoints.

---

## ADR-003: FastAPI for AI Engine

### Status
Accepted

### Context
- Need an ML service for anomaly and failure detection using sklearn (Isolation Forest, Random Forest); Python is the natural choice for data science.
- Constraints: Async inference, OpenAPI docs, health and metrics endpoints, minimal boilerplate.

### Decision
Use FastAPI for the AI engine (ai-engine/). Use Pydantic for schemas, sklearn for models, and uvicorn as ASGI server. Routers for health, inference, and metrics.

### Alternatives Considered
- **Flask**: Rejected: sync by default; less built-in validation and docs; FastAPI gives async and automatic OpenAPI.
- **NestJS for AI**: Rejected: Python ecosystem (sklearn, numpy) is standard for ML; maintaining ML in Node would require native bindings or separate Python process anyway.

### Consequences
- **Positive**: Fast development, automatic OpenAPI, async, good fit with sklearn and numpy; easy to add more models later.
- **Negative**: Two server stacks (NestJS + FastAPI); Python dependency and version management (e.g. 3.11 vs 3.13).

---

## ADR-004: Separate Executor Service

### Status
Accepted

### Context
- Need to perform Kubernetes actions (restart pod, scale, rollback) in a controlled way. Backend handles policy and audit; something must call the K8s API.
- Constraints: Least privilege (only one component holds K8s credentials); blast radius containment; audit and HMAC validation.

### Decision
Implement a standalone NestJS executor service (executor/) that is the only component that talks to the Kubernetes API. Backend keeps an in-process executor that validates HMAC and namespace, writes audit, and simulates (no K8s calls). Production calls go to the standalone executor with HMAC-signed requests.

### Alternatives Considered
- **Executor inside backend**: Rejected: backend would need K8s credentials and broad RBAC; compromise of backend would grant cluster access; harder to scope and audit.
- **Kubernetes Jobs/CronJobs only**: Rejected: need synchronous “execute now” from API and policy evaluation; jobs add latency and operational complexity for simple restart/scale/rollback.

### Consequences
- **Positive**: Single component with K8s access; namespace and action allowlist; HMAC and audit; backend stays stateless with respect to cluster.
- **Negative**: Extra service to deploy and operate; network and HMAC secret management; backend and executor must agree on payload and signature.

---

## ADR-005: Kubernetes vs Docker-Only

### Status
Accepted

### Context
- Production target is “real” deployments with scaling, networking, and secrets. Docker Compose is for local and single-host.
- Constraints: Support both local dev (Compose) and production (K8s); do not force K8s for every environment.

### Decision
Use Docker Compose for local and prod-like single-host (backend/docker-compose.prod.yml: postgres, redis, api, frontend). Use Kubernetes (k8s/ with Kustomize overlays) for staging and production. CI can build images and optionally deploy to K8s; rollback is manual (kubectl rollout undo) or GitOps.

### Alternatives Considered
- **Docker-only (Compose or Swarm)**: Rejected: K8s is the primary target for “infrastructure control plane” and executor; RBAC, network policies, and scaling are needed in production.
- **K8s-only (no Compose)**: Rejected: local dev and quick testing are easier with Compose; not every contributor has a cluster.

### Consequences
- **Positive**: Local simplicity with Compose; production-ready patterns (RBAC, network policies, secrets) in K8s; same images for both.
- **Negative**: Two deployment paths to maintain; K8s manifests and Compose can drift; operator must understand both.

---

## ADR-006: Redis for Rate Limiting & Caching

### Status
Accepted

### Context
- Need distributed rate limiting (per-IP, per-user) and optional policy decision cache across backend instances.
- Constraints: Backend is multi-instance capable; rate limit must be consistent; low latency.

### Decision
Use Redis for rate limit counters (key per subject + endpoint, TTL) and for policy evaluation cache (TTL). Use NestJS ThrottlerModule with custom guard that uses RedisService (incr, expire). No Redis means rate limit guard fails open (request allowed, logged).

### Alternatives Considered
- **In-memory only**: Rejected: not shared across instances; rate limit would be per-process and weak under load.
- **PostgreSQL for rate limit**: Rejected: higher latency and load on DB; Redis is designed for counters and TTL.

### Consequences
- **Positive**: Shared rate limit and cache; well-understood pattern; Redis is common in production.
- **Negative**: Additional dependency; fail-open on Redis failure is a deliberate tradeoff (availability over strict rate limiting when Redis is down).

---

## ADR-007: Loki Instead of Elasticsearch

### Status
Accepted

### Context
- Need log aggregation for debugging and dashboards; Prometheus already chosen for metrics.
- Constraints: Prefer stack that fits Prometheus/Grafana ecosystem; avoid heavy operational footprint if possible.

### Decision
Use Loki for log aggregation. Observability stack (observability/) includes Loki; Grafana datasources point to Loki and Prometheus. Backend (and other services) emit structured logs that are Loki-friendly. Backend logs API (GET /api/v1/logs) reads from PostgreSQL, not Loki; Loki is for operational log search and dashboards.

### Alternatives Considered
- **Elasticsearch/OpenSearch**: Rejected: heavier to run and operate; Loki is simpler and integrates with Grafana; full-text search not a primary requirement.
- **PostgreSQL-only for logs**: Rejected: application logs (stdout) and high volume are better in a log store; Loki keeps query model close to Prometheus (labels, LogQL).

### Consequences
- **Positive**: Single observability stack (Prometheus + Loki + Grafana); LogQL and labels; lower ops burden than Elasticsearch.
- **Negative**: Loki is less capable for complex full-text search; backend “logs” API is DB-backed, not Loki, so two concepts of “logs” (app logs vs audit/API logs).

---

## ADR-008: JWT Instead of OAuth2

### Status
Accepted

### Context
- Need user authentication and API protection; no requirement for “login with Google/GitHub” or multi-tenant OAuth delegation initially.
- Constraints: Stateless or low-state access tokens; refresh for long-lived sessions; simple to implement and reason about.

### Decision
Use JWT access tokens (short-lived, e.g. 15m) and refresh tokens (e.g. 7d) issued by the backend. Passport JWT strategy validates access token; refresh endpoint validates refresh token (from cookie or body) and rotates. No OAuth2 provider or OIDC in scope.

### Alternatives Considered
- **OAuth2/OIDC (e.g. Keycloak, Auth0)**: Rejected: adds external dependency and complexity; current scope is first-party users only; can be added later if SSO is required.
- **Session cookies only (no JWT)**: Rejected: need to support API clients and WebSockets; JWT allows stateless validation and simple attachment in headers.

### Consequences
- **Positive**: Simple model; no external IdP; refresh rotation reduces theft window; well-understood.
- **Negative**: No SSO; no standardized OAuth2 scopes; revocation is via refresh invalidation only (no access-token blocklist).

---

## ADR-009: Isolation Forest for Anomaly Detection

### Status
Accepted

### Context
- Need unsupervised anomaly detection on metrics (and optionally log-derived features) for self-healing recommendations.
- Constraints: Interpretable, trainable offline, works with tabular numeric data; sklearn ecosystem.

### Decision
Use Isolation Forest (sklearn) plus Elliptic Envelope for anomaly detection in the AI engine. Isolation Forest for general anomalies; Elliptic Envelope for Gaussian-style outliers. Preprocessing and feature engineering in a dedicated module; inference exposed via FastAPI; training exists in code but is not exposed as an HTTP job by default.

### Alternatives Considered
- **Autoencoders / deep learning**: Rejected: more complexity and data hunger; Isolation Forest is interpretable and sufficient for many metric-based anomalies.
- **Static thresholds only**: Rejected: goal is to detect anomalies without manual threshold tuning; ML provides score and severity.

### Consequences
- **Positive**: No labels required for training; fast inference; well-understood algorithm; safe default when untrained (low severity).
- **Negative**: Quality depends on training data; no online learning; Elliptic Envelope assumes roughly Gaussian distribution for some features.

---

## ADR-010: REST Over gRPC (Current State)

### Status
Accepted

### Context
- Backend, AI engine, and executor expose HTTP APIs. Frontend and automation call backend; backend calls AI engine and (conceptually) executor.
- Constraints: Ease of debugging and integration; broad client support; OpenAPI/docs where possible.

### Decision
Use REST over HTTP/JSON for all public and service-to-service APIs. No gRPC. OpenAPI/Swagger where generated (e.g. FastAPI); backend uses NestJS controllers and DTOs.

### Alternatives Considered
- **gRPC for service-to-service**: Rejected: more tooling and codegen; debugging is harder; REST + JSON is sufficient for current QPS and latency; no strong need for streaming or binary efficiency.
- **GraphQL**: Rejected: frontend does not require flexible querying; REST + multiple endpoints is simpler for this control-plane API.

### Consequences
- **Positive**: Simple to test (curl, Postman); easy to add clients in any language; no proto maintenance.
- **Negative**: No built-in streaming; payload size and latency may be higher than gRPC for very high frequency or large payloads (not current requirement).

---

## ADR-011: WebSockets for Real-Time Updates

### Status
Accepted

### Context
- Frontend needs real-time alerts (and optionally metrics/events) without polling.
- Constraints: Backend already has NestJS; need auth and reconnection handling.

### Decision
Use WebSockets (NestJS gateway) for alerts. Clients connect with JWT (e.g. in query or header); server emits alert events. Frontend uses a WebSocket hook with reconnection and auth. No Server-Sent Events or long-polling for this use case.

### Alternatives Considered
- **Polling**: Rejected: higher latency and load; worse UX for “new alert” indicators.
- **SSE**: Rejected: one-way only; WebSocket allows future bidirectional use; NestJS has first-class gateway support.

### Consequences
- **Positive**: Real-time alerts; single connection; fits NestJS model.
- **Negative**: Sticky sessions or shared state required for multi-instance backend (e.g. Redis adapter); per-connection rate limiting not implemented (possible DoS via many connections).

---

## ADR-012: No Hybrid Database (Postgres-Only for Persistence)

### Status
Accepted

### Context
- Need durable store for users, policies, audit logs, alerts, predictions, executor actions, logs table, settings. Need fast counters and cache for rate limit and policy cache.
- Constraints: Consistency and auditability for core data; speed for rate limit and cache.

### Decision
Use PostgreSQL for all durable, consistent data (backend, executor audit, optional AI engine). Use Redis only for ephemeral or cache data (rate limit counters, policy cache TTL). No second OLTP database (e.g. no MySQL alongside Postgres). “Logs” in backend are a table in Postgres for GET /api/v1/logs; Loki is separate for application log streams.

### Alternatives Considered
- **Add MongoDB or another document store**: Rejected: policy and audit need transactional consistency and relations; Postgres is sufficient; adding another DB increases ops and consistency concerns.
- **Redis for everything ephemeral**: Accepted for rate limit and cache only; not for audit or policy storage (durability and query needs).

### Consequences
- **Positive**: Single source of truth for durable data; ACID and relations; simpler backup and restore story.
- **Negative**: Postgres is the bottleneck for write-heavy audit; must tune and scale Postgres (e.g. read replicas) if load grows.

---

## ADR-013: Partial Automation Instead of Full Auto-Remediation

### Status
Accepted

### Context
- Goal is “self-healing” but uncontrolled automation can cause cascading failures or wrong actions. Policy and human oversight are required.
- Constraints: Safety over speed; audit and DENY by default.

### Decision
Implement policy evaluation and executor with HMAC and namespace allowlist; do not implement a fully closed loop (e.g. Prometheus → AI → Backend evaluate → Executor execute) without explicit wiring and policy. Human or automation can call evaluate and execute; policy can DENY automatic execution. “Partial” means: detection and recommendation (AI), decision (policy), and execution (executor) exist, but end-to-end automation is optional and policy-gated.

### Alternatives Considered
- **Full auto-remediation by default**: Rejected: too risky without more runtime safeguards and confidence in AI output; policy DENY and human-in-the-loop are safer.
- **No automation (manual only)**: Rejected: executor and policy exist to enable safe automation when policy allows; goal is to support both manual and automated flows.

### Consequences
- **Positive**: Safety and audit; operator controls what is automated via policy; no “runaway” remediation by default.
- **Negative**: Full closed loop requires custom wiring (e.g. cron or event handler that calls AI → evaluate → execute); not out-of-the-box.

---

## ADR-014: Frontend-First Observability Dashboards

### Status
Partially Accepted

### Context
- Operators need to see metrics, alerts, and health. Grafana is the standard for Prometheus/Loki; Aegis also has an in-app dashboard (Next.js frontend).
- Constraints: Avoid duplicate effort; frontend shows “product” view (alerts, policies, AI insights); Grafana shows “infra” view (latency, errors, logs).

### Decision
Provide both: (1) Next.js frontend with dashboard, alerts, AI insights, policies, logs viewer, health page—oriented at operators using the product. (2) Grafana dashboards (observability/grafana) for Prometheus and Loki—oriented at SREs and debugging. Dashboards are provisioned via Grafana config; example aegis-overview dashboard in repo. “Frontend-first” means the main operator experience is the Aegis UI; Grafana is for deeper observability.

### Alternatives Considered
- **Grafana only**: Rejected: product UX (alerts, policies, logs) belongs in the app; Grafana is for metrics and log search.
- **Frontend only (no Grafana)**: Rejected: Prometheus/Loki and ad-hoc queries need Grafana; frontend does not replace Grafana for SRE workflows.

### Consequences
- **Positive**: Clear split: product UI vs observability stack; both can evolve independently.
- **Negative**: Two places to look (app vs Grafana); some overlap (e.g. “health” in app and “API health” in Grafana); dashboard definitions in repo may lag production metrics.

---

## ADR-015: Cursor-Assisted Development

### Status
Accepted

### Context
- Development is done with Cursor (and similar AI-assisted tools); docs and code may be generated or refactored with AI assistance.
- Constraints: Delivered artifact must reflect real implementation; no invented features; honest docs (ARCHITECTURE.md, SECURITY.md, RUNBOOK.md) that match the repo.

### Decision
Use Cursor (and similar tools) for implementation and documentation. All deliverables—code, ARCHITECTURE.md, SECURITY.md, DECISIONS.md, RUNBOOK.md—are reviewed and grounded in the actual repo. Status tables and “what is missing” sections are explicit; no marking of incomplete work as done. Decisions in DECISIONS.md reflect real choices (monorepo, NestJS, FastAPI, separate executor, etc.) and admit tradeoffs.

### Alternatives Considered
- **No AI-assisted development**: Rejected: tooling is in use; the decision is to document it and ensure output is accurate rather than to forbid it.
- **AI-generated docs only, no human review**: Rejected: docs must match codebase and be honest about gaps; human review and iteration are required.

### Consequences
- **Positive**: Faster iteration on boilerplate and docs; consistent structure across ARCHITECTURE, SECURITY, DECISIONS, RUNBOOK; explicit about limitations.
- **Negative**: Risk of plausible but incorrect details if review is shallow; must verify against repo (e.g. HMAC secret name, rate limit fail-open, missing mTLS). This ADR records that the project uses AI assistance and commits to accuracy and honesty in deliverables.
