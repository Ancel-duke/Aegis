# Aegis Infrastructure - Quick Start Guide

Get the complete Aegis database and caching infrastructure running in under 10 minutes.

## Prerequisites

- Docker & Docker Compose installed
- 4GB+ RAM available
- 10GB+ disk space

## 5-Minute Setup

### Step 1: Clone and Configure (2 minutes)

```bash
cd infrastructure

# Copy environment template
cp .env.example .env

# CRITICAL: Edit .env and change ALL passwords
nano .env
```

**Minimum required changes in `.env`**:
```env
BACKEND_DB_PASSWORD=<strong_password_here>
AI_DB_PASSWORD=<strong_password_here>
EXECUTOR_DB_PASSWORD=<strong_password_here>
REDIS_PASSWORD=<strong_password_here>
BACKUP_ENCRYPTION_KEY=<random_32_character_string>
```

### Step 2: Generate SSL Certificates (1 minute)

```bash
# Make script executable
chmod +x scripts/generate-ssl-certs.sh

# Generate certificates
./scripts/generate-ssl-certs.sh
```

### Step 3: Start Infrastructure (2 minutes)

```bash
# Start all services
docker-compose up -d

# Wait for services to be ready (30-60 seconds)
docker-compose ps
```

### Step 4: Initialize Databases (2 minutes)

```bash
# Make setup script executable
chmod +x scripts/setup-databases.sh

# Run database initialization
./scripts/setup-databases.sh
```

### Step 5: Verify Setup (1 minute)

```bash
# Test all connections
./scripts/test-connections.sh
```

## What You Get

✅ **3x PostgreSQL databases** (Backend, AI Engine, Executor)  
✅ **Redis** with SSL/TLS encryption  
✅ **Loki** for centralized logging  
✅ **Promtail** for log collection  
✅ **Automated daily backups** with 30-day retention  
✅ **SSL/TLS** on all connections  
✅ **Network isolation** between services  

## Quick Access

### PostgreSQL

```bash
# Backend Database (Port 5432)
docker exec -it aegis-postgres-backend psql -U aegis_backend_user -d aegis_backend

# AI Engine Database (Port 5433)
docker exec -it aegis-postgres-ai psql -U aegis_ai_user -d aegis_ai

# Executor Database (Port 5434)
docker exec -it aegis-postgres-executor psql -U aegis_executor_user -d aegis_executor
```

### Redis

```bash
# Connect to Redis
docker exec -it aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt -a <password>

# Test connection
docker exec -it aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt -a <password> PING
```

### Loki

```bash
# Check Loki health
curl http://localhost:3100/ready

# Query logs
curl -G http://localhost:3100/loki/api/v1/query_range \
  --data-urlencode 'query={job="aegis-backend"}' \
  --data-urlencode 'limit=10'
```

## Connection Strings

Add these to your application `.env` files:

### Backend Service

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=aegis_backend_user
DB_PASSWORD=<your_password>
DB_DATABASE=aegis_backend
DB_SSL_MODE=require

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<your_password>
REDIS_TLS=true

# Loki
LOKI_URL=http://localhost:3100
```

### AI Engine Service

```env
# PostgreSQL
AI_DB_HOST=localhost
AI_DB_PORT=5433
AI_DB_USER=aegis_ai_user
AI_DB_PASSWORD=<your_password>
AI_DB_NAME=aegis_ai
AI_DB_SSL_MODE=require

# Redis (shared)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<your_password>

# Loki
LOKI_URL=http://localhost:3100
```

### Executor Service

```env
# PostgreSQL
EXECUTOR_DB_HOST=localhost
EXECUTOR_DB_PORT=5434
EXECUTOR_DB_USER=aegis_executor_user
EXECUTOR_DB_PASSWORD=<your_password>
EXECUTOR_DB_NAME=aegis_executor
EXECUTOR_DB_SSL_MODE=require

# Loki
LOKI_URL=http://localhost:3100
```

## Common Commands

```bash
# View logs
docker-compose logs -f [service_name]

# Restart a service
docker-compose restart [service_name]

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v

# Run manual backup
docker exec aegis-backup-service /usr/local/bin/backup.sh

# Restore from backup
docker exec aegis-backup-service /usr/local/bin/restore.sh backend latest
```

## Monitoring

```bash
# Check service health
docker-compose ps

# Database connections
docker exec aegis-postgres-backend psql -U aegis_backend_user -d aegis_backend \
  -c "SELECT count(*) FROM pg_stat_activity;"

# Redis stats
docker exec aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt \
  -a <password> INFO stats

# Disk usage
docker exec aegis-postgres-backend du -sh /var/lib/postgresql/data
```

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs

# Check disk space
df -h

# Check if ports are in use
netstat -tulpn | grep -E '5432|5433|5434|6379|3100'
```

### Cannot connect to database

```bash
# Verify service is running
docker ps | grep postgres

# Check if database exists
docker exec aegis-postgres-backend psql -U aegis_backend_user -l

# Test connection
docker exec aegis-postgres-backend pg_isready -U aegis_backend_user -d aegis_backend
```

### SSL certificate errors

```bash
# Regenerate certificates
rm -rf ssl/
./scripts/generate-ssl-certs.sh

# Restart services
docker-compose restart
```

### Out of disk space

```bash
# Check sizes
du -sh backups/
docker system df

# Clean old backups
find backups/ -name "*.sql*" -mtime +30 -delete

# Clean Docker
docker system prune -a
```

## Production Deployment

Before going to production:

1. ✅ Change all default passwords
2. ✅ Replace self-signed SSL certificates
3. ✅ Set up external backup storage
4. ✅ Configure monitoring alerts
5. ✅ Enable firewall rules
6. ✅ Test disaster recovery
7. ✅ Review and tune performance settings

See [README.md](README.md) for detailed production checklist.

## Next Steps

1. **Start Application Services**: `cd ../backend && docker-compose up -d`
2. **Run Migrations**: Execute any pending database migrations
3. **Create Test Data**: Insert initial users and policies
4. **Configure Monitoring**: Set up Grafana dashboards
5. **Test Backups**: Verify backup and restore procedures

## Getting Help

- **Full Documentation**: [README.md](README.md)
- **Schema Details**: Check `postgres/*/init/01-schema.sql` files
- **Connection Examples**: See `examples/` directory
- **Backup Scripts**: Review `scripts/backup.sh` and `scripts/restore.sh`

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│         Aegis Application Services               │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐     │
│  │  Backend   │ │AI Engine │ │ Executor │     │
│  └─────┬──────┘ └────┬─────┘ └────┬─────┘     │
│        │             │            │            │
└────────┼─────────────┼────────────┼────────────┘
         │             │            │
         ▼             ▼            ▼
┌─────────────────────────────────────────────────┐
│      Infrastructure (This Setup)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │PostgreSQL│ │PostgreSQL│ │PostgreSQL│        │
│  │ Backend  │ │    AI    │ │ Executor │        │
│  └──────────┘ └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐                     │
│  │  Redis   │ │   Loki   │                     │
│  └──────────┘ └──────────┘                     │
└─────────────────────────────────────────────────┘
```

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review logs: `docker-compose logs`
3. Consult [README.md](README.md) for detailed documentation
4. Check connection examples in `examples/` directory

---

**Estimated Total Setup Time**: 5-10 minutes  
**Estimated Resource Usage**: 2GB RAM, 5GB disk
