## Aegis Infrastructure

Complete database and caching infrastructure for the Aegis platform with SSL/TLS, backups, and monitoring.

## Overview

This infrastructure includes:

- **3x PostgreSQL Databases**: Backend, AI Engine, Executor (each with dedicated instance)
- **Redis**: Session cache, rate limiting, distributed locks
- **Loki**: Centralized log aggregation
- **Promtail**: Log collection and forwarding
- **Automated Backups**: Daily backups with retention policies
- **SSL/TLS**: All connections encrypted
- **Network Isolation**: Separate networks for each service group

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Aegis Infrastructure                    │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ PostgreSQL   │  │ PostgreSQL   │  │PostgreSQL │ │
│  │  Backend     │  │  AI Engine   │  │ Executor  │ │
│  │  Port: 5432  │  │  Port: 5433  │  │Port: 5434 │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │    Redis     │  │     Loki     │  │ Promtail  │ │
│  │  Port: 6379  │  │  Port: 3100  │  │  Logs     │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐│
│  │         Automated Backup Service                ││
│  │         Daily backups + rotation                ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Initial Setup

```bash
cd infrastructure

# Copy environment file
cp .env.example .env

# IMPORTANT: Edit .env and change all passwords
nano .env
```

### 2. Generate SSL Certificates

```bash
# Generate self-signed certificates (for development)
chmod +x scripts/generate-ssl-certs.sh
./scripts/generate-ssl-certs.sh
```

For production, replace self-signed certificates with CA-signed certificates.

### 3. Start Infrastructure

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps
```

### 4. Initialize Databases

```bash
# Run database setup script
chmod +x scripts/setup-databases.sh
./scripts/setup-databases.sh
```

### 5. Verify Setup

```bash
# Check PostgreSQL Backend
docker exec aegis-postgres-backend psql -U aegis_backend_user -d aegis_backend -c "SELECT version();"

# Check PostgreSQL AI
docker exec aegis-postgres-ai psql -U aegis_ai_user -d aegis_ai -c "SELECT version();"

# Check PostgreSQL Executor
docker exec aegis-postgres-executor psql -U aegis_executor_user -d aegis_executor -c "SELECT version();"

# Check Redis
docker exec aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt -a your_password PING

# Check Loki
curl http://localhost:3100/ready
```

## Services

### PostgreSQL - Backend (Port 5432)

**Purpose**: User authentication, roles, policies, policy audit logs

**Tables**:
- `users` - User accounts
- `roles` - RBAC roles
- `user_roles` - User-role mappings
- `policies` - Policy definitions
- `policy_audit_logs` - Immutable policy evaluation logs
- `session_cache` - Session fallback cache

**Connection String**:
```
postgresql://aegis_backend_user:password@localhost:5432/aegis_backend?sslmode=require
```

### PostgreSQL - AI Engine (Port 5433)

**Purpose**: ML predictions, model metrics, training data

**Tables**:
- `prediction_history` - All ML predictions
- `model_metrics` - Model performance metrics
- `training_data` - Training datasets
- `anomaly_detections` - Anomaly-specific results
- `failure_predictions` - Failure prediction results
- `feature_store` - Feature engineering output
- `model_registry` - Model versioning

**Connection String**:
```
postgresql://aegis_ai_user:password@localhost:5433/aegis_ai?sslmode=require
```

### PostgreSQL - Executor (Port 5434)

**Purpose**: Kubernetes action audit logs

**Tables**:
- `action_audit_logs` - Immutable action execution logs
- `action_statistics` - Aggregated statistics
- `rate_limit_tracking` - Rate limit tracking
- `execution_errors` - Detailed error information

**Connection String**:
```
postgresql://aegis_executor_user:password@localhost:5434/aegis_executor?sslmode=require
```

### Redis (Port 6379)

**Purpose**: Caching, rate limiting, distributed locks

**Features**:
- Session caching
- Rate limit counters
- Distributed locks
- Policy decision caching
- SSL/TLS encryption
- AOF + RDB persistence

**Connection**:
```bash
redis-cli --tls --cacert ssl/redis/ca.crt -h localhost -p 6379 -a your_password
```

### Loki (Port 3100)

**Purpose**: Centralized log aggregation

**Features**:
- 90-day retention
- Label-based querying
- Compression
- Integration with Grafana

**API**:
```bash
# Query logs
curl -G http://localhost:3100/loki/api/v1/query_range \
  --data-urlencode 'query={job="aegis-backend"}' \
  --data-urlencode 'limit=100'
```

## Database Schemas

### Backend Schema Highlights

```sql
-- Users with roles
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true
);

-- Policies
CREATE TABLE policies (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    effect VARCHAR(10) CHECK (effect IN ('allow', 'deny')),
    actions TEXT[] NOT NULL,
    resources TEXT[] NOT NULL,
    conditions JSONB,
    priority INTEGER DEFAULT 100
);

-- Immutable audit logs
CREATE TABLE policy_audit_logs (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    resource TEXT NOT NULL,
    result VARCHAR(10) CHECK (result IN ('allow', 'deny')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### AI Engine Schema Highlights

```sql
-- Prediction history
CREATE TABLE prediction_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    prediction JSONB NOT NULL,
    severity_score NUMERIC(5, 4),
    recommended_action VARCHAR(100)
);

-- Anomaly detections
CREATE TABLE anomaly_detections (
    id SERIAL PRIMARY KEY,
    prediction_id INTEGER REFERENCES prediction_history(id),
    anomaly_score NUMERIC(5, 4) NOT NULL,
    is_anomaly BOOLEAN NOT NULL,
    severity VARCHAR(20),
    affected_metrics TEXT[]
);
```

### Executor Schema Highlights

```sql
-- Immutable action audit logs
CREATE TABLE action_audit_logs (
    id UUID PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    resource_name VARCHAR(255) NOT NULL,
    action_params JSONB NOT NULL,
    policy_decision JSONB,
    execution_duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

## Backup & Restore

### Automated Backups

Backups run daily at 2 AM by default.

**Configuration** (`.env`):
```env
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
BACKUP_RETENTION_DAYS=30    # Keep 30 days
BACKUP_ENCRYPTION_KEY=your_random_key
```

**Manual Backup**:
```bash
docker exec aegis-backup-service /usr/local/bin/backup.sh
```

**Backup Location**:
```
backups/
├── postgres-backend/
│   └── backend_20240125_020000.sql.gz.enc
├── postgres-ai/
│   └── ai_20240125_020000.sql.gz.enc
├── postgres-executor/
│   └── executor_20240125_020000.sql.gz.enc
└── redis/
    └── redis_20240125_020000.rdb.gz
```

### Restore from Backup

```bash
# List available backups
docker exec aegis-backup-service /usr/local/bin/restore.sh backend list

# Restore latest backend backup
docker exec aegis-backup-service /usr/local/bin/restore.sh backend latest

# Restore specific backup
docker exec aegis-backup-service /usr/local/bin/restore.sh backend /backups/postgres-backend/backend_20240125.sql.gz
```

## Security

### SSL/TLS Encryption

All database and cache connections use SSL/TLS:

- **PostgreSQL**: SSL certificates for client-server encryption
- **Redis**: TLS encryption with client certificates
- **Loki**: HTTPS optional (for production)

**Certificate Locations**:
```
ssl/
├── ca/
│   ├── ca.crt          # CA certificate
│   └── ca.key          # CA private key
├── postgres/
│   ├── backend/
│   ├── ai/
│   └── executor/
└── redis/
```

### Connection Pooling

**Backend Service** (`backend/src/app.module.ts`):
```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('ssl/postgres/backend/ca.crt').toString(),
  },
  // Connection pooling
  extra: {
    max: 20,  // Maximum pool size
    min: 2,   // Minimum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});
```

**AI Engine** (`ai-engine/app/models/database.py`):
```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    connect_args={
        "sslmode": "require",
        "sslcert": "ssl/postgres/ai/client.crt",
        "sslkey": "ssl/postgres/ai/client.key",
        "sslrootcert": "ssl/postgres/ai/ca.crt",
    }
)
```

### Network Isolation

Each service group has its own Docker network:

- `aegis-backend-net` (172.20.0.0/24) - Backend + Redis + Loki
- `aegis-ai-net` (172.21.0.0/24) - AI Engine + Redis + Loki
- `aegis-executor-net` (172.22.0.0/24) - Executor + Redis + Loki

## Monitoring

### Database Health Checks

```bash
# Check all databases
docker-compose ps

# PostgreSQL Backend
docker exec aegis-postgres-backend pg_isready -U aegis_backend_user -d aegis_backend

# PostgreSQL AI
docker exec aegis-postgres-ai pg_isready -U aegis_ai_user -d aegis_ai

# PostgreSQL Executor
docker exec aegis-postgres-executor pg_isready -U aegis_executor_user -d aegis_executor

# Redis
docker exec aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt -a password PING
```

### Query Loki Logs

```bash
# Recent backend logs
curl -G http://localhost:3100/loki/api/v1/query_range \
  --data-urlencode 'query={job="aegis-backend"}' \
  --data-urlencode 'limit=100'

# Failed actions from executor
curl -G http://localhost:3100/loki/api/v1/query_range \
  --data-urlencode 'query={job="aegis-executor",status="failed"}' \
  --data-urlencode 'limit=50'

# High severity anomalies
curl -G http://localhost:3100/loki/api/v1/query_range \
  --data-urlencode 'query={job="aegis-ai-engine",level="error"}' \
  --data-urlencode 'limit=50'
```

### Database Statistics

```bash
# Backend database size
docker exec aegis-postgres-backend psql -U aegis_backend_user -d aegis_backend \
  -c "SELECT pg_size_pretty(pg_database_size('aegis_backend'));"

# Most active tables
docker exec aegis-postgres-backend psql -U aegis_backend_user -d aegis_backend \
  -c "SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del FROM pg_stat_user_tables ORDER BY n_tup_ins DESC;"

# Connection count
docker exec aegis-postgres-backend psql -U aegis_backend_user -d aegis_backend \
  -c "SELECT count(*) FROM pg_stat_activity;"

# Redis memory usage
docker exec aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt -a password INFO memory
```

## Maintenance

### Database Vacuum

```bash
# Vacuum Backend database
docker exec aegis-postgres-backend psql -U aegis_backend_user -d aegis_backend -c "VACUUM ANALYZE;"

# Vacuum AI database
docker exec aegis-postgres-ai psql -U aegis_ai_user -d aegis_ai -c "VACUUM ANALYZE;"

# Vacuum Executor database
docker exec aegis-postgres-executor psql -U aegis_executor_user -d aegis_executor -c "VACUUM ANALYZE;"
```

### Archive Old Data

```bash
# Archive old policy audit logs (90+ days)
docker exec aegis-postgres-backend psql -U aegis_backend_user -d aegis_backend \
  -c "DELETE FROM policy_audit_logs WHERE created_at < NOW() - INTERVAL '90 days';"

# Archive old predictions (90+ days)
docker exec aegis-postgres-ai psql -U aegis_ai_user -d aegis_ai \
  -c "SELECT archive_old_predictions(90);"

# Archive old action logs (90+ days)
docker exec aegis-postgres-executor psql -U aegis_executor_user -d aegis_executor \
  -c "SELECT archive_old_audit_logs(90);"
```

### Redis Maintenance

```bash
# Get Redis info
docker exec aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt -a password INFO

# Flush expired keys
docker exec aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt -a password --scan --pattern "*" | xargs redis-cli --tls --cacert /etc/redis/ssl/ca.crt -a password DEL

# Save snapshot
docker exec aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt -a password BGSAVE
```

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check logs
docker logs aegis-postgres-backend

# Check if database exists
docker exec aegis-postgres-backend psql -U aegis_backend_user -l

# Test connection
docker exec aegis-postgres-backend psql -U aegis_backend_user -d aegis_backend -c "SELECT 1;"
```

### Redis Connection Issues

```bash
# Check logs
docker logs aegis-redis

# Test connection without TLS
docker exec aegis-redis redis-cli -a password PING

# Check TLS certificates
docker exec aegis-redis ls -la /etc/redis/ssl/
```

### Loki Issues

```bash
# Check logs
docker logs aegis-loki

# Check ready status
curl http://localhost:3100/ready

# Check metrics
curl http://localhost:3100/metrics
```

### Disk Space

```bash
# Check disk usage
docker exec aegis-postgres-backend du -sh /var/lib/postgresql/data
docker exec aegis-redis du -sh /data
docker exec aegis-loki du -sh /loki

# Check backup size
du -sh backups/
```

## Production Checklist

- [ ] Change all default passwords in `.env`
- [ ] Replace self-signed certificates with CA-signed certificates
- [ ] Configure firewall rules (only allow necessary ports)
- [ ] Set up external backup storage (S3, Azure Blob, etc.)
- [ ] Configure automated backup verification
- [ ] Set up monitoring alerts (disk space, connection errors)
- [ ] Configure log rotation for Loki
- [ ] Enable PostgreSQL replication for high availability
- [ ] Set up Redis Sentinel or Cluster for HA
- [ ] Configure database connection pooling in applications
- [ ] Test disaster recovery procedures
- [ ] Document runbooks for common issues

## Performance Tuning

### PostgreSQL

Edit `docker-compose.yml` PostgreSQL command:

```yaml
command: >
  postgres
  -c shared_buffers=512MB
  -c effective_cache_size=2GB
  -c max_connections=300
  -c work_mem=5MB
```

### Redis

Edit `redis/redis.conf`:

```conf
maxmemory 1gb
maxmemory-policy allkeys-lru
save 900 1 300 10
```

### Loki

Edit `loki/loki-config.yml`:

```yaml
limits_config:
  ingestion_rate_mb: 32
  ingestion_burst_size_mb: 64
  retention_period: 180d
```

## Support

For infrastructure issues:

1. Check service logs: `docker-compose logs [service]`
2. Verify network connectivity
3. Check disk space
4. Review SSL certificate validity
5. Consult troubleshooting section

## License

MIT
