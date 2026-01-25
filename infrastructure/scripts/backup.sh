#!/bin/bash

# =====================================================
# Aegis Database Backup Script
# Backs up all PostgreSQL databases and Redis data
# =====================================================

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY:-""}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# =====================================================
# Backup Backend Database
# =====================================================
backup_backend_db() {
    log "Backing up Backend database..."
    
    local backup_file="${BACKUP_DIR}/postgres-backend/backend_${TIMESTAMP}.sql"
    local compressed_file="${backup_file}.gz"
    
    PGPASSWORD="${BACKEND_DB_PASSWORD}" pg_dump \
        -h postgres-backend \
        -U "${BACKEND_DB_USER}" \
        -d "${BACKEND_DB_NAME}" \
        -F p \
        --no-owner \
        --no-acl \
        --verbose \
        > "${backup_file}" 2>&1
    
    if [ $? -eq 0 ]; then
        gzip "${backup_file}"
        
        # Encrypt if key is provided
        if [ ! -z "$ENCRYPTION_KEY" ]; then
            openssl enc -aes-256-cbc -salt -pbkdf2 \
                -in "${compressed_file}" \
                -out "${compressed_file}.enc" \
                -k "${ENCRYPTION_KEY}"
            rm "${compressed_file}"
            compressed_file="${compressed_file}.enc"
        fi
        
        local size=$(du -h "${compressed_file}" | cut -f1)
        log "Backend database backup completed: ${compressed_file} (${size})"
    else
        error "Backend database backup failed"
        return 1
    fi
}

# =====================================================
# Backup AI Database
# =====================================================
backup_ai_db() {
    log "Backing up AI Engine database..."
    
    local backup_file="${BACKUP_DIR}/postgres-ai/ai_${TIMESTAMP}.sql"
    local compressed_file="${backup_file}.gz"
    
    PGPASSWORD="${AI_DB_PASSWORD}" pg_dump \
        -h postgres-ai \
        -U "${AI_DB_USER}" \
        -d "${AI_DB_NAME}" \
        -F p \
        --no-owner \
        --no-acl \
        --verbose \
        > "${backup_file}" 2>&1
    
    if [ $? -eq 0 ]; then
        gzip "${backup_file}"
        
        if [ ! -z "$ENCRYPTION_KEY" ]; then
            openssl enc -aes-256-cbc -salt -pbkdf2 \
                -in "${compressed_file}" \
                -out "${compressed_file}.enc" \
                -k "${ENCRYPTION_KEY}"
            rm "${compressed_file}"
            compressed_file="${compressed_file}.enc"
        fi
        
        local size=$(du -h "${compressed_file}" | cut -f1)
        log "AI database backup completed: ${compressed_file} (${size})"
    else
        error "AI database backup failed"
        return 1
    fi
}

# =====================================================
# Backup Executor Database
# =====================================================
backup_executor_db() {
    log "Backing up Executor database..."
    
    local backup_file="${BACKUP_DIR}/postgres-executor/executor_${TIMESTAMP}.sql"
    local compressed_file="${backup_file}.gz"
    
    PGPASSWORD="${EXECUTOR_DB_PASSWORD}" pg_dump \
        -h postgres-executor \
        -U "${EXECUTOR_DB_USER}" \
        -d "${EXECUTOR_DB_NAME}" \
        -F p \
        --no-owner \
        --no-acl \
        --verbose \
        > "${backup_file}" 2>&1
    
    if [ $? -eq 0 ]; then
        gzip "${backup_file}"
        
        if [ ! -z "$ENCRYPTION_KEY" ]; then
            openssl enc -aes-256-cbc -salt -pbkdf2 \
                -in "${compressed_file}" \
                -out "${compressed_file}.enc" \
                -k "${ENCRYPTION_KEY}"
            rm "${compressed_file}"
            compressed_file="${compressed_file}.enc"
        fi
        
        local size=$(du -h "${compressed_file}" | cut -f1)
        log "Executor database backup completed: ${compressed_file} (${size})"
    else
        error "Executor database backup failed"
        return 1
    fi
}

# =====================================================
# Backup Redis
# =====================================================
backup_redis() {
    log "Backing up Redis data..."
    
    local backup_file="${BACKUP_DIR}/redis/redis_${TIMESTAMP}.rdb"
    
    # Trigger Redis save
    redis-cli --tls --cacert /etc/redis/ssl/ca.crt \
        -h redis -p 6380 -a "${REDIS_PASSWORD}" \
        BGSAVE
    
    # Wait for save to complete
    sleep 5
    
    # Copy RDB file
    docker cp aegis-redis:/data/dump.rdb "${backup_file}"
    
    if [ $? -eq 0 ]; then
        gzip "${backup_file}"
        local size=$(du -h "${backup_file}.gz" | cut -f1)
        log "Redis backup completed: ${backup_file}.gz (${size})"
    else
        error "Redis backup failed"
        return 1
    fi
}

# =====================================================
# Cleanup Old Backups
# =====================================================
cleanup_old_backups() {
    log "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    local deleted_count=0
    
    # Clean Backend backups
    find "${BACKUP_DIR}/postgres-backend" -name "backend_*.sql*" -mtime +${RETENTION_DAYS} -delete
    deleted_count=$((deleted_count + $(find "${BACKUP_DIR}/postgres-backend" -name "backend_*.sql*" -mtime +${RETENTION_DAYS} | wc -l)))
    
    # Clean AI backups
    find "${BACKUP_DIR}/postgres-ai" -name "ai_*.sql*" -mtime +${RETENTION_DAYS} -delete
    deleted_count=$((deleted_count + $(find "${BACKUP_DIR}/postgres-ai" -name "ai_*.sql*" -mtime +${RETENTION_DAYS} | wc -l)))
    
    # Clean Executor backups
    find "${BACKUP_DIR}/postgres-executor" -name "executor_*.sql*" -mtime +${RETENTION_DAYS} -delete
    deleted_count=$((deleted_count + $(find "${BACKUP_DIR}/postgres-executor" -name "executor_*.sql*" -mtime +${RETENTION_DAYS} | wc -l)))
    
    # Clean Redis backups
    find "${BACKUP_DIR}/redis" -name "redis_*.rdb*" -mtime +${RETENTION_DAYS} -delete
    deleted_count=$((deleted_count + $(find "${BACKUP_DIR}/redis" -name "redis_*.rdb*" -mtime +${RETENTION_DAYS} | wc -l)))
    
    log "Cleaned up ${deleted_count} old backup files"
}

# =====================================================
# Generate Backup Report
# =====================================================
generate_report() {
    local report_file="${BACKUP_DIR}/backup_report_${TIMESTAMP}.txt"
    
    {
        echo "=================================================="
        echo "Aegis Backup Report"
        echo "=================================================="
        echo "Date: $(date)"
        echo "Retention: ${RETENTION_DAYS} days"
        echo ""
        echo "Backend Database:"
        ls -lh "${BACKUP_DIR}/postgres-backend" | tail -5
        echo ""
        echo "AI Database:"
        ls -lh "${BACKUP_DIR}/postgres-ai" | tail -5
        echo ""
        echo "Executor Database:"
        ls -lh "${BACKUP_DIR}/postgres-executor" | tail -5
        echo ""
        echo "Redis:"
        ls -lh "${BACKUP_DIR}/redis" | tail -5
        echo ""
        echo "Disk Usage:"
        du -sh "${BACKUP_DIR}"/*
    } > "${report_file}"
    
    log "Backup report generated: ${report_file}"
}

# =====================================================
# Main Execution
# =====================================================
main() {
    log "Starting Aegis backup process..."
    
    # Create backup directories if they don't exist
    mkdir -p "${BACKUP_DIR}/postgres-backend"
    mkdir -p "${BACKUP_DIR}/postgres-ai"
    mkdir -p "${BACKUP_DIR}/postgres-executor"
    mkdir -p "${BACKUP_DIR}/redis"
    
    # Perform backups
    backup_backend_db || error "Backend backup failed"
    backup_ai_db || error "AI backup failed"
    backup_executor_db || error "Executor backup failed"
    backup_redis || error "Redis backup failed"
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Generate report
    generate_report
    
    log "Backup process completed successfully!"
}

# Run main function
main "$@"
