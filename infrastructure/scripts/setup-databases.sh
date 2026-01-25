#!/bin/bash

# =====================================================
# Aegis Database Setup Script
# Initializes all databases and runs migrations
# =====================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[SETUP]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[SETUP]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    warn "No .env file found, using defaults"
fi

# Check if services are running
check_services() {
    log "Checking if services are running..."
    
    # Check PostgreSQL Backend
    if ! docker ps | grep -q "aegis-postgres-backend"; then
        error "PostgreSQL Backend is not running"
        return 1
    fi
    
    # Check PostgreSQL AI
    if ! docker ps | grep -q "aegis-postgres-ai"; then
        error "PostgreSQL AI is not running"
        return 1
    fi
    
    # Check PostgreSQL Executor
    if ! docker ps | grep -q "aegis-postgres-executor"; then
        error "PostgreSQL Executor is not running"
        return 1
    fi
    
    # Check Redis
    if ! docker ps | grep -q "aegis-redis"; then
        error "Redis is not running"
        return 1
    fi
    
    log "✅ All services are running"
}

# Wait for database to be ready
wait_for_db() {
    local host=$1
    local port=$2
    local user=$3
    local dbname=$4
    local max_attempts=30
    local attempt=1
    
    log "Waiting for database ${dbname} to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec aegis-postgres-${host} pg_isready -U ${user} -d ${dbname} > /dev/null 2>&1; then
            log "✅ Database ${dbname} is ready"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    error "Database ${dbname} failed to become ready"
    return 1
}

# Initialize Backend Database
setup_backend_db() {
    log "Setting up Backend database..."
    
    wait_for_db "backend" 5432 "${BACKEND_DB_USER}" "${BACKEND_DB_NAME}"
    
    # Run initialization scripts
    log "Running Backend database initialization scripts..."
    docker exec aegis-postgres-backend psql -U ${BACKEND_DB_USER} -d ${BACKEND_DB_NAME} \
        -f /docker-entrypoint-initdb.d/01-schema.sql
    
    log "✅ Backend database setup complete"
}

# Initialize AI Database
setup_ai_db() {
    log "Setting up AI Engine database..."
    
    wait_for_db "ai" 5432 "${AI_DB_USER}" "${AI_DB_NAME}"
    
    # Run initialization scripts
    log "Running AI database initialization scripts..."
    docker exec aegis-postgres-ai psql -U ${AI_DB_USER} -d ${AI_DB_NAME} \
        -f /docker-entrypoint-initdb.d/01-schema.sql
    
    log "✅ AI database setup complete"
}

# Initialize Executor Database
setup_executor_db() {
    log "Setting up Executor database..."
    
    wait_for_db "executor" 5432 "${EXECUTOR_DB_USER}" "${EXECUTOR_DB_NAME}"
    
    # Run initialization scripts
    log "Running Executor database initialization scripts..."
    docker exec aegis-postgres-executor psql -U ${EXECUTOR_DB_USER} -d ${EXECUTOR_DB_NAME} \
        -f /docker-entrypoint-initdb.d/01-schema.sql
    
    log "✅ Executor database setup complete"
}

# Test Redis connection
test_redis() {
    log "Testing Redis connection..."
    
    if docker exec aegis-redis redis-cli --tls --cacert /etc/redis/ssl/ca.crt \
        -a "${REDIS_PASSWORD}" PING | grep -q "PONG"; then
        log "✅ Redis connection successful"
    else
        error "Redis connection failed"
        return 1
    fi
}

# Create database backups directory
setup_backup_dirs() {
    log "Creating backup directories..."
    
    mkdir -p backups/postgres-backend
    mkdir -p backups/postgres-ai
    mkdir -p backups/postgres-executor
    mkdir -p backups/redis
    
    log "✅ Backup directories created"
}

# Generate SSL certificates if not exist
setup_ssl() {
    if [ ! -f ssl/ca/ca.crt ]; then
        log "SSL certificates not found, generating..."
        ./scripts/generate-ssl-certs.sh
    else
        log "✅ SSL certificates already exist"
    fi
}

# Create test data (optional)
create_test_data() {
    log "Would you like to create test data? (y/n)"
    read -r response
    
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log "Creating test data..."
        
        # Create test user in Backend
        docker exec aegis-postgres-backend psql -U ${BACKEND_DB_USER} -d ${BACKEND_DB_NAME} <<-EOSQL
            -- Insert test admin user
            INSERT INTO users (email, password, first_name, last_name, is_active)
            VALUES ('admin@aegis.local', '\$2b\$10\$XqN7X6Y8Z9A0B1C2D3E4F.hashed', 'Admin', 'User', true)
            ON CONFLICT (email) DO NOTHING;
            
            -- Insert test user
            INSERT INTO users (email, password, first_name, last_name, is_active)
            VALUES ('user@aegis.local', '\$2b\$10\$XqN7X6Y8Z9A0B1C2D3E4F.hashed', 'Test', 'User', true)
            ON CONFLICT (email) DO NOTHING;
EOSQL
        
        log "✅ Test data created"
        log "   Admin: admin@aegis.local / password"
        log "   User: user@aegis.local / password"
    fi
}

# Display connection info
display_connection_info() {
    log ""
    log "=================================================="
    log "Aegis Database Setup Complete!"
    log "=================================================="
    log ""
    log "PostgreSQL Backend:"
    log "  Host: localhost"
    log "  Port: 5432"
    log "  Database: ${BACKEND_DB_NAME}"
    log "  User: ${BACKEND_DB_USER}"
    log ""
    log "PostgreSQL AI:"
    log "  Host: localhost"
    log "  Port: 5433"
    log "  Database: ${AI_DB_NAME}"
    log "  User: ${AI_DB_USER}"
    log ""
    log "PostgreSQL Executor:"
    log "  Host: localhost"
    log "  Port: 5434"
    log "  Database: ${EXECUTOR_DB_NAME}"
    log "  User: ${EXECUTOR_DB_USER}"
    log ""
    log "Redis:"
    log "  Host: localhost"
    log "  Port: 6379 (TLS: 6380)"
    log "  Password: ${REDIS_PASSWORD}"
    log ""
    log "Loki:"
    log "  URL: http://localhost:3100"
    log ""
    log "Next steps:"
    log "  1. Start application services"
    log "  2. Run initial data migrations"
    log "  3. Configure backup schedule"
    log ""
}

# Main execution
main() {
    log "Starting Aegis database setup..."
    
    check_services
    setup_ssl
    setup_backup_dirs
    setup_backend_db
    setup_ai_db
    setup_executor_db
    test_redis
    create_test_data
    display_connection_info
    
    log "✅ Setup complete!"
}

# Run main function
main "$@"
