#!/bin/bash

# =====================================================
# Aegis Database Restore Script
# Restores PostgreSQL databases from backups
# =====================================================

set -e

# Configuration
BACKUP_DIR="/backups"
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
# List Available Backups
# =====================================================
list_backups() {
    local db_type=$1
    
    case $db_type in
        backend)
            log "Available Backend database backups:"
            ls -lht "${BACKUP_DIR}/postgres-backend/backend_*.sql*" | head -10
            ;;
        ai)
            log "Available AI database backups:"
            ls -lht "${BACKUP_DIR}/postgres-ai/ai_*.sql*" | head -10
            ;;
        executor)
            log "Available Executor database backups:"
            ls -lht "${BACKUP_DIR}/postgres-executor/executor_*.sql*" | head -10
            ;;
        *)
            error "Unknown database type: $db_type"
            return 1
            ;;
    esac
}

# =====================================================
# Restore Backend Database
# =====================================================
restore_backend_db() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    log "Restoring Backend database from: $backup_file"
    
    # Handle encrypted files
    if [[ "$backup_file" == *.enc ]]; then
        if [ -z "$ENCRYPTION_KEY" ]; then
            error "Backup is encrypted but no encryption key provided"
            return 1
        fi
        
        local decrypted_file="${backup_file%.enc}"
        openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "$backup_file" \
            -out "$decrypted_file" \
            -k "$ENCRYPTION_KEY"
        backup_file="$decrypted_file"
    fi
    
    # Decompress if needed
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" > "${backup_file%.gz}"
        backup_file="${backup_file%.gz}"
    fi
    
    # Drop existing database and recreate
    warn "This will DROP the existing database. Press Ctrl+C to cancel..."
    sleep 5
    
    PGPASSWORD="${BACKEND_DB_PASSWORD}" psql \
        -h postgres-backend \
        -U "${BACKEND_DB_USER}" \
        -d postgres \
        -c "DROP DATABASE IF EXISTS ${BACKEND_DB_NAME};"
    
    PGPASSWORD="${BACKEND_DB_PASSWORD}" psql \
        -h postgres-backend \
        -U "${BACKEND_DB_USER}" \
        -d postgres \
        -c "CREATE DATABASE ${BACKEND_DB_NAME};"
    
    # Restore data
    PGPASSWORD="${BACKEND_DB_PASSWORD}" psql \
        -h postgres-backend \
        -U "${BACKEND_DB_USER}" \
        -d "${BACKEND_DB_NAME}" \
        < "$backup_file"
    
    if [ $? -eq 0 ]; then
        log "Backend database restored successfully"
    else
        error "Backend database restore failed"
        return 1
    fi
}

# =====================================================
# Restore AI Database
# =====================================================
restore_ai_db() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    log "Restoring AI database from: $backup_file"
    
    # Handle encrypted files
    if [[ "$backup_file" == *.enc ]]; then
        if [ -z "$ENCRYPTION_KEY" ]; then
            error "Backup is encrypted but no encryption key provided"
            return 1
        fi
        
        local decrypted_file="${backup_file%.enc}"
        openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "$backup_file" \
            -out "$decrypted_file" \
            -k "$ENCRYPTION_KEY"
        backup_file="$decrypted_file"
    fi
    
    # Decompress if needed
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" > "${backup_file%.gz}"
        backup_file="${backup_file%.gz}"
    fi
    
    warn "This will DROP the existing database. Press Ctrl+C to cancel..."
    sleep 5
    
    PGPASSWORD="${AI_DB_PASSWORD}" psql \
        -h postgres-ai \
        -U "${AI_DB_USER}" \
        -d postgres \
        -c "DROP DATABASE IF EXISTS ${AI_DB_NAME};"
    
    PGPASSWORD="${AI_DB_PASSWORD}" psql \
        -h postgres-ai \
        -U "${AI_DB_USER}" \
        -d postgres \
        -c "CREATE DATABASE ${AI_DB_NAME};"
    
    PGPASSWORD="${AI_DB_PASSWORD}" psql \
        -h postgres-ai \
        -U "${AI_DB_USER}" \
        -d "${AI_DB_NAME}" \
        < "$backup_file"
    
    if [ $? -eq 0 ]; then
        log "AI database restored successfully"
    else
        error "AI database restore failed"
        return 1
    fi
}

# =====================================================
# Restore Executor Database
# =====================================================
restore_executor_db() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    log "Restoring Executor database from: $backup_file"
    
    # Handle encrypted files
    if [[ "$backup_file" == *.enc ]]; then
        if [ -z "$ENCRYPTION_KEY" ]; then
            error "Backup is encrypted but no encryption key provided"
            return 1
        fi
        
        local decrypted_file="${backup_file%.enc}"
        openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "$backup_file" \
            -out "$decrypted_file" \
            -k "$ENCRYPTION_KEY"
        backup_file="$decrypted_file"
    fi
    
    # Decompress if needed
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" > "${backup_file%.gz}"
        backup_file="${backup_file%.gz}"
    fi
    
    warn "This will DROP the existing database. Press Ctrl+C to cancel..."
    sleep 5
    
    PGPASSWORD="${EXECUTOR_DB_PASSWORD}" psql \
        -h postgres-executor \
        -U "${EXECUTOR_DB_USER}" \
        -d postgres \
        -c "DROP DATABASE IF EXISTS ${EXECUTOR_DB_NAME};"
    
    PGPASSWORD="${EXECUTOR_DB_PASSWORD}" psql \
        -h postgres-executor \
        -U "${EXECUTOR_DB_USER}" \
        -d postgres \
        -c "CREATE DATABASE ${EXECUTOR_DB_NAME};"
    
    PGPASSWORD="${EXECUTOR_DB_PASSWORD}" psql \
        -h postgres-executor \
        -U "${EXECUTOR_DB_USER}" \
        -d "${EXECUTOR_DB_NAME}" \
        < "$backup_file"
    
    if [ $? -eq 0 ]; then
        log "Executor database restored successfully"
    else
        error "Executor database restore failed"
        return 1
    fi
}

# =====================================================
# Main Execution
# =====================================================
usage() {
    echo "Usage: $0 {backend|ai|executor} [backup_file|latest]"
    echo ""
    echo "Examples:"
    echo "  $0 backend latest                        # Restore latest backend backup"
    echo "  $0 ai /backups/postgres-ai/ai_20240101.sql.gz    # Restore specific AI backup"
    echo "  $0 executor list                         # List available executor backups"
}

main() {
    if [ $# -lt 1 ]; then
        usage
        exit 1
    fi
    
    local db_type=$1
    local backup_spec=${2:-latest}
    
    # List backups if requested
    if [ "$backup_spec" == "list" ]; then
        list_backups "$db_type"
        exit 0
    fi
    
    # Determine backup file
    local backup_file
    if [ "$backup_spec" == "latest" ]; then
        case $db_type in
            backend)
                backup_file=$(ls -t "${BACKUP_DIR}/postgres-backend/backend_"*.sql* | head -1)
                ;;
            ai)
                backup_file=$(ls -t "${BACKUP_DIR}/postgres-ai/ai_"*.sql* | head -1)
                ;;
            executor)
                backup_file=$(ls -t "${BACKUP_DIR}/postgres-executor/executor_"*.sql* | head -1)
                ;;
        esac
    else
        backup_file="$backup_spec"
    fi
    
    if [ -z "$backup_file" ]; then
        error "No backup file found"
        exit 1
    fi
    
    log "Using backup file: $backup_file"
    
    # Restore database
    case $db_type in
        backend)
            restore_backend_db "$backup_file"
            ;;
        ai)
            restore_ai_db "$backup_file"
            ;;
        executor)
            restore_executor_db "$backup_file"
            ;;
        *)
            error "Unknown database type: $db_type"
            usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
