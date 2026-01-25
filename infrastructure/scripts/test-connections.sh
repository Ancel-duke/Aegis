#!/bin/bash

# =====================================================
# Aegis Connection Test Script
# Tests all infrastructure connections
# =====================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

log() {
    echo -e "${GREEN}[TEST]${NC} $1"
}

pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    FAILED=$((FAILED + 1))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "=========================================="
echo "  Aegis Infrastructure Connection Tests  "
echo "=========================================="
echo ""

# =====================================================
# Test PostgreSQL Databases
# =====================================================
log "Testing PostgreSQL databases..."

# Backend
if docker exec aegis-postgres-backend pg_isready -U ${BACKEND_DB_USER} -d ${BACKEND_DB_NAME} > /dev/null 2>&1; then
    pass "PostgreSQL Backend is ready"
    
    # Test query
    if docker exec aegis-postgres-backend psql -U ${BACKEND_DB_USER} -d ${BACKEND_DB_NAME} -c "SELECT 1;" > /dev/null 2>&1; then
        pass "PostgreSQL Backend can execute queries"
    else
        fail "PostgreSQL Backend query failed"
    fi
    
    # Check if users table exists
    if docker exec aegis-postgres-backend psql -U ${BACKEND_DB_USER} -d ${BACKEND_DB_NAME} \
        -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');" | grep -q "t"; then
        pass "Backend schema is initialized"
    else
        warn "Backend schema may not be initialized"
    fi
else
    fail "PostgreSQL Backend is not ready"
fi

echo ""

# AI
if docker exec aegis-postgres-ai pg_isready -U ${AI_DB_USER} -d ${AI_DB_NAME} > /dev/null 2>&1; then
    pass "PostgreSQL AI is ready"
    
    if docker exec aegis-postgres-ai psql -U ${AI_DB_USER} -d ${AI_DB_NAME} -c "SELECT 1;" > /dev/null 2>&1; then
        pass "PostgreSQL AI can execute queries"
    else
        fail "PostgreSQL AI query failed"
    fi
    
    if docker exec aegis-postgres-ai psql -U ${AI_DB_USER} -d ${AI_DB_NAME} \
        -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prediction_history');" | grep -q "t"; then
        pass "AI schema is initialized"
    else
        warn "AI schema may not be initialized"
    fi
else
    fail "PostgreSQL AI is not ready"
fi

echo ""

# Executor
if docker exec aegis-postgres-executor pg_isready -U ${EXECUTOR_DB_USER} -d ${EXECUTOR_DB_NAME} > /dev/null 2>&1; then
    pass "PostgreSQL Executor is ready"
    
    if docker exec aegis-postgres-executor psql -U ${EXECUTOR_DB_USER} -d ${EXECUTOR_DB_NAME} -c "SELECT 1;" > /dev/null 2>&1; then
        pass "PostgreSQL Executor can execute queries"
    else
        fail "PostgreSQL Executor query failed"
    fi
    
    if docker exec aegis-postgres-executor psql -U ${EXECUTOR_DB_USER} -d ${EXECUTOR_DB_NAME} \
        -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'action_audit_logs');" | grep -q "t"; then
        pass "Executor schema is initialized"
    else
        warn "Executor schema may not be initialized"
    fi
else
    fail "PostgreSQL Executor is not ready"
fi

echo ""

# =====================================================
# Test Redis
# =====================================================
log "Testing Redis..."

if docker exec aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt \
    -a "${REDIS_PASSWORD}" PING 2>/dev/null | grep -q "PONG"; then
    pass "Redis connection successful"
    
    # Test set/get
    if docker exec aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt \
        -a "${REDIS_PASSWORD}" SET test_key "test_value" > /dev/null 2>&1; then
        pass "Redis can write data"
        
        if docker exec aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt \
            -a "${REDIS_PASSWORD}" GET test_key 2>/dev/null | grep -q "test_value"; then
            pass "Redis can read data"
        else
            fail "Redis read failed"
        fi
        
        # Cleanup
        docker exec aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt \
            -a "${REDIS_PASSWORD}" DEL test_key > /dev/null 2>&1
    else
        fail "Redis write failed"
    fi
else
    fail "Redis connection failed"
fi

echo ""

# =====================================================
# Test Loki
# =====================================================
log "Testing Loki..."

if curl -s http://localhost:3100/ready > /dev/null 2>&1; then
    pass "Loki is ready"
    
    # Test log push
    if curl -s -X POST http://localhost:3100/loki/api/v1/push \
        -H "Content-Type: application/json" \
        -d '{
            "streams": [
                {
                    "stream": {"job": "test", "level": "info"},
                    "values": [["'$(date +%s%N)'", "test message"]]
                }
            ]
        }' > /dev/null 2>&1; then
        pass "Loki can accept log pushes"
    else
        fail "Loki log push failed"
    fi
else
    fail "Loki is not ready"
fi

echo ""

# =====================================================
# Test Promtail
# =====================================================
log "Testing Promtail..."

if docker ps | grep -q "aegis-promtail"; then
    pass "Promtail is running"
else
    fail "Promtail is not running"
fi

echo ""

# =====================================================
# Test SSL Certificates
# =====================================================
log "Testing SSL certificates..."

# PostgreSQL Backend
if [ -f postgres/backend/ssl/server.crt ]; then
    pass "PostgreSQL Backend certificate exists"
    
    # Check certificate validity
    if openssl x509 -in postgres/backend/ssl/server.crt -noout -checkend 86400 2>/dev/null; then
        pass "PostgreSQL Backend certificate is valid"
    else
        warn "PostgreSQL Backend certificate expires soon"
    fi
else
    fail "PostgreSQL Backend certificate not found"
fi

# Redis
if [ -f redis/ssl/redis.crt ]; then
    pass "Redis certificate exists"
    
    if openssl x509 -in redis/ssl/redis.crt -noout -checkend 86400 2>/dev/null; then
        pass "Redis certificate is valid"
    else
        warn "Redis certificate expires soon"
    fi
else
    fail "Redis certificate not found"
fi

echo ""

# =====================================================
# Test Backup System
# =====================================================
log "Testing backup system..."

if docker ps | grep -q "aegis-backup-service"; then
    pass "Backup service is running"
    
    # Check if backup directories exist
    if [ -d backups/postgres-backend ] && [ -d backups/postgres-ai ] && [ -d backups/postgres-executor ]; then
        pass "Backup directories exist"
    else
        warn "Some backup directories are missing"
    fi
else
    fail "Backup service is not running"
fi

echo ""

# =====================================================
# Test Network Connectivity
# =====================================================
log "Testing network connectivity..."

# Backend network
if docker network ls | grep -q "aegis-backend-net"; then
    pass "Backend network exists"
else
    fail "Backend network not found"
fi

# AI network
if docker network ls | grep -q "aegis-ai-net"; then
    pass "AI network exists"
else
    fail "AI network not found"
fi

# Executor network
if docker network ls | grep -q "aegis-executor-net"; then
    pass "Executor network exists"
else
    fail "Executor network not found"
fi

echo ""

# =====================================================
# Database Statistics
# =====================================================
log "Database statistics..."

echo "Backend Database:"
docker exec aegis-postgres-backend psql -U ${BACKEND_DB_USER} -d ${BACKEND_DB_NAME} \
    -c "SELECT pg_size_pretty(pg_database_size('${BACKEND_DB_NAME}'));" 2>/dev/null | grep -v "pg_size_pretty" | grep -v "row" | tr -d ' ' || echo "N/A"

echo "AI Database:"
docker exec aegis-postgres-ai psql -U ${AI_DB_USER} -d ${AI_DB_NAME} \
    -c "SELECT pg_size_pretty(pg_database_size('${AI_DB_NAME}'));" 2>/dev/null | grep -v "pg_size_pretty" | grep -v "row" | tr -d ' ' || echo "N/A"

echo "Executor Database:"
docker exec aegis-postgres-executor psql -U ${EXECUTOR_DB_USER} -d ${EXECUTOR_DB_NAME} \
    -c "SELECT pg_size_pretty(pg_database_size('${EXECUTOR_DB_NAME}'));" 2>/dev/null | grep -v "pg_size_pretty" | grep -v "row" | tr -d ' ' || echo "N/A"

echo ""

# =====================================================
# Summary
# =====================================================
echo "=========================================="
echo "           Test Summary                   "
echo "=========================================="
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "Your Aegis infrastructure is ready to use."
    echo ""
    echo "Next steps:"
    echo "  1. Start application services"
    echo "  2. Connect services to databases"
    echo "  3. Run initial data migrations"
    echo "  4. Configure monitoring"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Please review the failed tests above and:"
    echo "  1. Check service logs: docker-compose logs [service]"
    echo "  2. Verify .env configuration"
    echo "  3. Ensure all services are running: docker-compose ps"
    echo "  4. Re-run database setup: ./scripts/setup-databases.sh"
    exit 1
fi
