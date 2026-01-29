# Aegis Security Model

---

## 1. Security Philosophy

- **Zero trust**: No service or user is trusted by default. Every request is authenticated (JWT for users, HMAC for executor calls) and authorized (policy evaluation). Internal service-to-service calls do not use mTLS today; trust is established via shared secrets (JWT_SECRET for HMAC on executor) and network segmentation where deployed.
- **Least privilege**: The executor is the only component that talks to the Kubernetes API; it is scoped by namespace allowlist and K8s RBAC. Users and roles are granted minimal permissions via policy (admin, user, auditor). Backend and AI engine do not hold K8s credentials.
- **Defense in depth**: Multiple layers: rate limiting at API edge, JWT validation, policy evaluation before sensitive actions, HMAC validation at executor, namespace allowlist, and (in K8s) network policies. A single control failure does not imply full compromise.
- **Fail-safe defaults**: Policy evaluation defaults to DENY; missing or invalid HMAC at executor results in 403; rate limit guard fails open on Redis errors (request allowed, logged) to avoid total outage—this is a known tradeoff. Unauthenticated routes (login, health) are explicitly marked and rate-limited.
- **Auditability over convenience**: Policy evaluations and executor actions are written to PostgreSQL with no in-place updates. Auth events (signup, login, logout) and failures are logged. Audit logs are not user-deletable. Convenience features (e.g. long-lived tokens) are avoided in favor of refresh rotation and short-lived access tokens.

---

## 2. Threat Model Overview

**Attacker profiles**

- **External unauthenticated attacker**: No valid JWT or HMAC. Can only reach public endpoints (login, signup, health, forgot/reset password). Mitigations: rate limiting (per-IP on auth), strong password requirements, bcryptjs hashing, refresh token binding. Can attempt brute force, DoS, or injection on public inputs.
- **Authenticated malicious user**: Has valid JWT. Can attempt to escalate (e.g. access admin-only resources), tamper with policies they can edit, or exfiltrate data. Mitigations: role-based policy evaluation, same-user-or-admin guards on profile, policy CRUD and evaluate audited. Cannot call executor directly without HMAC (backend holds EXECUTOR_HMAC_SECRET; user does not).
- **Compromised internal service**: e.g. AI engine or a backend instance. Can call backend APIs if it has network access; can call executor if it obtains or shares HMAC secret. Mitigations: executor HMAC (shared secret); namespace allowlist limits blast radius. No mTLS—compromised service on same network can impersonate another service if secrets are exfiltrated.
- **Compromised Kubernetes pod**: Attacker has code execution in a pod. Can use pod identity (service account) to call K8s API within RBAC bounds. Executor pod has RBAC for restart/scale/rollback in allowed namespaces only. Mitigations: namespace-scoped Roles, least-privilege service accounts, network policies limiting which pods can reach executor. Full cluster admin is out of scope.
- **Supply-chain attacker**: Compromised dependency or build pipeline. Mitigations: lockfiles (package-lock.json, requirements.txt), pinned base images in Dockerfiles, CI runs tests. No SBOM or signed artifacts; no formal supply-chain verification.

**Assets**

- **Credentials**: JWT signing secrets (JWT_SECRET, JWT_REFRESH_SECRET), DB passwords, Redis password, executor HMAC secret (currently JWT_SECRET in standalone executor—same as backend JWT). Stored in env/config; in K8s, in Secrets (template only; operator must replace).
- **Policies**: Stored in PostgreSQL; define who can do what. Tampering or privilege escalation via policy change is a high-impact threat; changes are audited but not cryptographically verified post-write.
- **Audit logs**: Policy evaluations, executor actions, auth events. Immutable in app (no update/delete API); DB admin could alter. Critical for repudiation and incident response.
- **Infrastructure control plane**: Kubernetes API. Only executor talks to it; scope limited by namespace allowlist and RBAC.
- **AI decisions**: Predictions (anomaly, failure, severity) influence automated or human decisions. Stored in backend DB. False positives can drive unnecessary remediation; model poisoning is a theoretical risk (training not exposed over network by default).

---

## 3. Trust Boundaries

- **Frontend ↔ Backend**: Browser to API. Trust: JWT in cookie or header; CORS and same-origin. Not hardened: no CSP or subresource integrity documented; frontend can be modified by attacker; backend does not validate request origin beyond CORS. HTTPS is operator responsibility.
- **Backend ↔ AI Engine**: HTTP. Trust: optional API key; backend calls AI engine for inference. Not hardened: no mTLS; AI engine URL in config. Compromised backend can send arbitrary input to AI engine.
- **Backend ↔ Executor**: HTTP. Trust: HMAC on request body (actionType, actionParams, requestedBy); shared secret (backend: EXECUTOR_HMAC_SECRET, standalone executor: JWT_SECRET). Hardened: HMAC validation; namespace and action allowlist at executor. Not hardened: no mTLS; replay protection (timestamp/nonce) not explicitly documented in code.
- **Executor ↔ Kubernetes API**: TLS (K8s API server). Trust: service account token; RBAC. Hardened: namespace-scoped Roles; only restart/scale/rollback. Not hardened: no pod security standards (e.g. restricted) explicitly enforced in runbook; secrets in env.
- **CI/CD ↔ Cluster**: GitHub Actions to registry and optionally to cluster. Trust: GitHub credentials; image push; kubectl apply. Not hardened: no signed images; no admission control; secrets in GitHub. Out of scope: full supply-chain and GitOps verification.

---

## 4. Attack Surfaces

- **REST APIs**: Backend (NestJS) exposes auth, users, policies, policy/evaluate, alerts, metrics, AI proxy, executor (in-process stub), logs, settings. All except public auth/health require JWT. Input: JSON bodies and query params; validated with class-validator. Risk: injection, mass assignment, IDOR. Mitigations: validation, RBAC, audit.
- **WebSocket connections**: Alerts gateway; clients send token in query or header. Risk: unauthenticated subscription if token missing; flooding. Mitigations: auth on connect; rate limiting is per-HTTP endpoint, not per-WS message—possible DoS via many connections.
- **Policy JSON input**: Policy CRUD accepts JSON (name, description, rules). Risk: malicious rules (e.g. allow-all), oversized payload. Mitigations: validation; evaluation is server-side; audit. No schema enforcement beyond app validation.
- **AI inference endpoints**: POST with metrics/logs. Risk: prompt-style injection if free text is ever passed; resource exhaustion (large input, many requests). Mitigations: no training exposed by default; inference timeout and sizing are deployment concerns.
- **Executor action endpoints**: POST with actionType, actionParams, requestedBy, signature. Risk: forged request if HMAC secret leaks; parameter injection (e.g. namespace) to escape allowlist—mitigated by server-side allowlist check. Replay: no mandatory nonce/timestamp in code.
- **CI/CD pipeline**: Build and test; push images; optional deploy. Risk: compromised runner or secrets; malicious PR. Mitigations: branch protection; secrets in GitHub; no attestation or signing.
- **Kubernetes RBAC**: Executor service account. Risk: over-permissive Role. Mitigations: manifests use namespace-scoped get/list/delete (pods), get/list/patch/update (deployments); operator must review.

---

## 5. Threats & Mitigations (STRIDE-style)

### Spoofing

- **JWT theft**: Stolen access or refresh token. Mitigations: short-lived access tokens; refresh rotation; refresh stored server-side (Redis/DB) and invalidated on reuse; HTTPS and HttpOnly cookies are operator responsibility. Missing: device binding; token binding to IP.
- **Service impersonation**: Attacker pretends to be backend or executor. Mitigations: executor validates HMAC (shared secret); backend does not validate caller identity for AI engine beyond optional API key. Missing: mTLS; so any host that can reach executor with the secret can impersonate.
- **Missing**: mTLS between services; certificate pinning; attested identity for CI/CD.

### Tampering

- **Policy manipulation**: User with policy write access changes rules to allow more. Mitigations: policy evaluation is server-side; all evaluations logged; admin can review. No cryptographic integrity of policy document.
- **Executor command tampering**: Request modified in transit. Mitigations: HMAC covers actionType, actionParams, requestedBy; tampering invalidates signature. Payload ordering must be canonical (JSON.stringify) on both sides.
- **Mitigations in place**: HMAC at executor; input validation; namespace/action allowlist.

### Repudiation

- **Action denial**: User or automation denies having triggered an action. Mitigations: executor and policy evaluations write to PostgreSQL with requestedBy, timestamp, result; no delete API for audit logs.
- **Audit log immutability**: App does not update/delete audit records. DB admin or backup restore could alter; no append-only store or hash chain.
- **Gaps**: No cryptographic signing of audit entries; no integrity verification in app.

### Information Disclosure

- **Logs leakage**: Application logs may contain PII or tokens. Mitigations: structured logging; no logging of full JWT in normal paths. Operator must configure log retention and access.
- **Metrics exposure**: /metrics endpoints expose request counts, latency. Mitigations: not exposed on public ingress in typical setup; network policies can restrict. No PII in default metrics.
- **Secrets exposure**: Env vars and K8s Secrets. Mitigations: no secrets in code; .env in .gitignore; secrets.yaml is a template. Missing: Vault or rotation; secrets in CI are in GitHub.
- **Mitigations**: No logging of passwords; refresh token hashed or stored with limited exposure; executor does not log full request body with signature.

### Denial of Service

- **API abuse**: High request rate. Mitigations: Redis-backed rate limiting per-IP (unauthenticated) and per-user (authenticated); configurable TTL and limit per endpoint; signup/login have stricter limits (e.g. 5/hour signup, 10/15min login).
- **WebSocket flooding**: Many connections or high message rate. Mitigations: auth on connect. Missing: per-connection rate limit; max connections per user.
- **AI inference overload**: Many or large requests. Mitigations: none at application level; deployment must use timeouts and resource limits.
- **Rate limiting strategy**: Fail-open on Redis failure (request allowed, logged) to avoid site-wide outage; operator should monitor Redis and rate-limit hits.

### Elevation of Privilege

- **Kubernetes RBAC escalation**: Executor SA granted more than necessary. Mitigations: manifests scope Roles to namespaces and verbs (get, list, delete for pods; get, list, patch, update for deployments); operator must apply least privilege.
- **Admin policy abuse**: Admin user creates policy that allows all. Mitigations: audit of policy create/update; no technical prevention of overly permissive policy.
- **Mitigations and controls**: Role-based policy evaluation (admin, user, auditor); same-user-or-admin guard on profile; executor does not trust client role—only HMAC and namespace.

---

## 6. Authentication & Authorization

- **JWT lifecycle**: Access token: short-lived (e.g. 15m), signed with JWT_SECRET; refresh token: longer (e.g. 7d), signed with JWT_REFRESH_SECRET, stored (e.g. DB or Redis) and validated on /auth/refresh. On refresh, new pair issued; refresh rotation (one-time use) reduces theft window.
- **Refresh token rotation**: Backend invalidates or rotates refresh token on use; reuse detection can invalidate all sessions for user. Implementation is in auth service (refreshTokens).
- **Role-based access control**: Roles (admin, user, auditor) are stored and used in policy evaluation. Policy engine evaluates (role, resource, action) and returns ALLOW/DENY. Guards (e.g. RolesGuard) enforce role on routes; same-user-or-admin for profile updates.
- **Admin-only paths**: Policy CRUD, user management, and similar are protected by role checks; only admin (or as defined in policy) can access. Exact routes are in backend controllers.
- **Known limitations**: No OIDC/SSO; no MFA; no account lockout after N failures (rate limit only); password reset is mock email (token in DB); JWT revocation is via refresh invalidation only (no blocklist of access tokens).

---

## 7. Executor Safety Model

- **Why executor is isolated**: Single service that talks to Kubernetes API; credentials and blast radius contained. Backend only does policy + HMAC + audit and simulates; it does not call K8s.
- **Namespace allowlisting**: Executor reads ALLOWED_NAMESPACES (comma-separated); only those namespaces are accepted in actionParams. Request with namespace not in list is rejected (403) and logged.
- **Action allowlist**: Only RESTART_POD, SCALE_DEPLOYMENT, ROLLBACK_DEPLOYMENT (and optionally DELETE_POD) are implemented; default branch throws BadRequestException for unknown action type. No arbitrary command execution.
- **HMAC signature validation**: Payload (actionType, actionParams, requestedBy) is serialized to canonical JSON; HMAC-SHA256 with shared secret (JWT_SECRET in standalone executor) is computed and compared to provided signature. Invalid or missing signature returns 403. Same secret must be configured at caller (e.g. backend) and executor.
- **Why arbitrary command execution is impossible**: Executor has no generic “run script” or “exec” action; only fixed actions (restart pod, scale, rollback) with parameters validated (namespace in allowlist, resource names). K8s API is called with typed clients (e.g. delete pod, patch deployment), not shell or arbitrary CRD.

---

## 8. Kubernetes Security

- **RBAC model**: Executor uses a dedicated service account; Role and RoleBinding per namespace (or single Role in executor namespace with namespace field). Verbs: pods get, list, delete; deployments get, list, patch, update. No cluster-admin; no create of Pods beyond what deployment does.
- **Pod security context**: Dockerfiles run as non-root (e.g. nextjs, node user); K8s manifests may set runAsNonRoot, readOnlyRootFilesystem where applicable. No formal Pod Security Standards (restricted/baseline) enforced in repo; operator should set.
- **Network policies**: Default deny ingress/egress in aegis namespace; allow DNS; backend/executor/ai-engine have explicit ingress (e.g. from ingress controller, from each other) and egress (e.g. DB, Redis, K8s API). Reduces lateral movement.
- **Secrets handling**: Secrets are K8s Secrets (Opaque); templates in k8s/secrets.yaml with placeholders. No Vault or External Secrets in repo; no rotation automation. Operator must replace placeholders and restrict access.
- **Implemented**: RBAC for executor; network policies; non-root in containers. **Planned/not in repo**: Pod Security Standards; Vault; signed images; admission control.

---

## 9. AI-Specific Risks

- **Model poisoning risk**: Training data or model artifact could be maliciously modified. Mitigations: training is not exposed over HTTP by default; inference-only deployment is common. If training is ever exposed or data is ingested from untrusted sources, poisoning becomes a real threat.
- **False positives**: Anomaly or failure model flags normal behavior as anomalous. Consequence: unnecessary remediation (restart, scale) or alert fatigue. Mitigations: severity and confidence in response; policy can DENY automated action; human-in-the-loop possible by policy. No automatic circuit breaker that disables AI after N false positives.
- **Automated remediation dangers**: Policy allows “auto-remediate” and executor runs restart/rollback at scale. Risk: cascading failure or wrong target. Mitigations: namespace and action allowlist; policy evaluation per request; audit. No rate limit on executor actions in code (operator can rate limit at API gateway).
- **Human-in-the-loop constraints**: Policy engine can require human approval by denying automatic execution; UI shows alerts and insights. No formal approval workflow (e.g. two-phase execute) in code; “human in the loop” is policy DENY plus manual trigger.

---

## 10. Known Security Gaps (Explicit)

- **Missing mTLS**: All service-to-service is HTTP (or HTTPS at load balancer). No mutual TLS between backend, AI engine, executor. Attacker on network with stolen HMAC can impersonate caller to executor.
- **No external pentest**: No evidence of third-party penetration test or formal assessment. Security is based on design and code review only.
- **No runtime policy verification**: Policies are stored and evaluated but not cryptographically signed or verified at read time. Compromised DB or admin could alter policy without detection by app.
- **No secrets rotation automation**: JWT and DB secrets are rotated manually. No Vault, no automatic rotation, no key versioning.
- **Executor HMAC secret**: Standalone executor uses JWT_SECRET for HMAC; same secret as JWT signing. Compromise of one use case affects the other; dedicated EXECUTOR_HMAC_SECRET recommended.
- **Rate limit fail-open**: On Redis failure, rate limit guard allows the request and logs. DoS possible if Redis is down.
- **No replay protection for executor**: HMAC validates payload integrity and authenticity but no mandatory timestamp or nonce in code; replay of a captured request may be possible within token lifetime.
- **Frontend health check**: Disabled in Docker; no integrity or availability check of frontend from orchestration perspective.

---

## 11. Security Roadmap

- Introduce mTLS (or mesh) between backend, AI engine, and executor; or document explicit “not in scope” for current deployment.
- Use a dedicated HMAC secret for executor (EXECUTOR_HMAC_SECRET) and stop using JWT_SECRET for HMAC.
- Add replay protection (timestamp + nonce or one-time token) for executor requests.
- Consider rate limit fail-closed or fallback (e.g. in-memory) when Redis is unavailable; or document and accept fail-open.
- Integrate secret management (e.g. Vault) and rotation for JWT, DB, Redis, executor secret.
- Optional: external penetration test and remediation; SBOM and supply-chain verification; audit log integrity (e.g. append-only store or signing).
