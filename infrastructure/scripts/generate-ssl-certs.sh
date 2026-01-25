#!/bin/bash

# =====================================================
# SSL Certificate Generation Script
# Generates self-signed certificates for development
# For production, use proper CA-signed certificates
# =====================================================

set -e

# Configuration
SSL_DIR="$(dirname "$0")/../ssl"
DAYS_VALID=365
COUNTRY="US"
STATE="State"
CITY="City"
ORG="Aegis"
OU="Infrastructure"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[SSL]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[SSL WARNING]${NC} $1"
}

# Create SSL directories
create_directories() {
    log "Creating SSL directories..."
    
    mkdir -p "${SSL_DIR}/ca"
    mkdir -p "${SSL_DIR}/postgres/backend"
    mkdir -p "${SSL_DIR}/postgres/ai"
    mkdir -p "${SSL_DIR}/postgres/executor"
    mkdir -p "${SSL_DIR}/redis"
    mkdir -p "${SSL_DIR}/loki"
}

# Generate CA certificate
generate_ca() {
    log "Generating CA certificate..."
    
    openssl genrsa -out "${SSL_DIR}/ca/ca.key" 4096
    
    openssl req -new -x509 -days ${DAYS_VALID} \
        -key "${SSL_DIR}/ca/ca.key" \
        -out "${SSL_DIR}/ca/ca.crt" \
        -subj "/C=${COUNTRY}/ST=${STATE}/L=${CITY}/O=${ORG}/OU=${OU}/CN=Aegis Root CA"
    
    log "CA certificate generated: ${SSL_DIR}/ca/ca.crt"
}

# Generate PostgreSQL certificates
generate_postgres_cert() {
    local service=$1
    local dir="${SSL_DIR}/postgres/${service}"
    
    log "Generating PostgreSQL ${service} certificates..."
    
    # Generate private key
    openssl genrsa -out "${dir}/server.key" 2048
    
    # Generate CSR
    openssl req -new \
        -key "${dir}/server.key" \
        -out "${dir}/server.csr" \
        -subj "/C=${COUNTRY}/ST=${STATE}/L=${CITY}/O=${ORG}/OU=${OU}/CN=postgres-${service}"
    
    # Sign with CA
    openssl x509 -req -days ${DAYS_VALID} \
        -in "${dir}/server.csr" \
        -CA "${SSL_DIR}/ca/ca.crt" \
        -CAkey "${SSL_DIR}/ca/ca.key" \
        -CAcreateserial \
        -out "${dir}/server.crt"
    
    # Copy CA cert
    cp "${SSL_DIR}/ca/ca.crt" "${dir}/ca.crt"
    
    # Set permissions
    chmod 600 "${dir}/server.key"
    chmod 644 "${dir}/server.crt"
    chmod 644 "${dir}/ca.crt"
    
    # Cleanup CSR
    rm "${dir}/server.csr"
    
    log "PostgreSQL ${service} certificates generated"
}

# Generate Redis certificates
generate_redis_cert() {
    local dir="${SSL_DIR}/redis"
    
    log "Generating Redis certificates..."
    
    # Generate private key
    openssl genrsa -out "${dir}/redis.key" 2048
    
    # Generate CSR
    openssl req -new \
        -key "${dir}/redis.key" \
        -out "${dir}/redis.csr" \
        -subj "/C=${COUNTRY}/ST=${STATE}/L=${CITY}/O=${ORG}/OU=${OU}/CN=redis"
    
    # Sign with CA
    openssl x509 -req -days ${DAYS_VALID} \
        -in "${dir}/redis.csr" \
        -CA "${SSL_DIR}/ca/ca.crt" \
        -CAkey "${SSL_DIR}/ca/ca.key" \
        -CAcreateserial \
        -out "${dir}/redis.crt"
    
    # Copy CA cert
    cp "${SSL_DIR}/ca/ca.crt" "${dir}/ca.crt"
    
    # Set permissions
    chmod 600 "${dir}/redis.key"
    chmod 644 "${dir}/redis.crt"
    chmod 644 "${dir}/ca.crt"
    
    # Cleanup CSR
    rm "${dir}/redis.csr"
    
    log "Redis certificates generated"
}

# Generate Loki certificates
generate_loki_cert() {
    local dir="${SSL_DIR}/loki"
    
    log "Generating Loki certificates..."
    
    # Generate private key
    openssl genrsa -out "${dir}/loki.key" 2048
    
    # Generate CSR
    openssl req -new \
        -key "${dir}/loki.key" \
        -out "${dir}/loki.csr" \
        -subj "/C=${COUNTRY}/ST=${STATE}/L=${CITY}/O=${ORG}/OU=${OU}/CN=loki"
    
    # Sign with CA
    openssl x509 -req -days ${DAYS_VALID} \
        -in "${dir}/loki.csr" \
        -CA "${SSL_DIR}/ca/ca.crt" \
        -CAkey "${SSL_DIR}/ca/ca.key" \
        -CAcreateserial \
        -out "${dir}/loki.crt"
    
    # Copy CA cert
    cp "${SSL_DIR}/ca/ca.crt" "${dir}/ca.crt"
    
    # Set permissions
    chmod 600 "${dir}/loki.key"
    chmod 644 "${dir}/loki.crt"
    chmod 644 "${dir}/ca.crt"
    
    # Cleanup CSR
    rm "${dir}/loki.csr"
    
    log "Loki certificates generated"
}

# Copy certificates to infrastructure directories
copy_certificates() {
    log "Copying certificates to infrastructure directories..."
    
    # PostgreSQL Backend
    cp "${SSL_DIR}/postgres/backend/"* "../postgres/backend/ssl/"
    
    # PostgreSQL AI
    cp "${SSL_DIR}/postgres/ai/"* "../postgres/ai/ssl/"
    
    # PostgreSQL Executor
    cp "${SSL_DIR}/postgres/executor/"* "../postgres/executor/ssl/"
    
    # Redis
    cp "${SSL_DIR}/redis/"* "../redis/ssl/"
    
    # Loki
    cp "${SSL_DIR}/loki/"* "../loki/ssl/"
    
    log "Certificates copied to infrastructure directories"
}

# Generate certificate info
generate_info() {
    local info_file="${SSL_DIR}/CERTIFICATE_INFO.txt"
    
    {
        echo "=================================================="
        echo "Aegis SSL Certificates"
        echo "=================================================="
        echo "Generated: $(date)"
        echo "Valid for: ${DAYS_VALID} days"
        echo ""
        echo "CA Certificate:"
        openssl x509 -in "${SSL_DIR}/ca/ca.crt" -noout -subject -dates
        echo ""
        echo "PostgreSQL Backend:"
        openssl x509 -in "${SSL_DIR}/postgres/backend/server.crt" -noout -subject -dates
        echo ""
        echo "PostgreSQL AI:"
        openssl x509 -in "${SSL_DIR}/postgres/ai/server.crt" -noout -subject -dates
        echo ""
        echo "PostgreSQL Executor:"
        openssl x509 -in "${SSL_DIR}/postgres/executor/server.crt" -noout -subject -dates
        echo ""
        echo "Redis:"
        openssl x509 -in "${SSL_DIR}/redis/redis.crt" -noout -subject -dates
        echo ""
        echo "Loki:"
        openssl x509 -in "${SSL_DIR}/loki/loki.crt" -noout -subject -dates
    } > "${info_file}"
    
    log "Certificate info saved: ${info_file}"
}

# Main execution
main() {
    warn "⚠️  These are self-signed certificates for DEVELOPMENT only"
    warn "⚠️  For production, use properly signed certificates from a trusted CA"
    
    create_directories
    generate_ca
    generate_postgres_cert "backend"
    generate_postgres_cert "ai"
    generate_postgres_cert "executor"
    generate_redis_cert
    generate_loki_cert
    copy_certificates
    generate_info
    
    log "✅ All SSL certificates generated successfully!"
    log "📁 Certificates location: ${SSL_DIR}"
    log ""
    log "Next steps:"
    log "  1. Review certificate info: cat ${SSL_DIR}/CERTIFICATE_INFO.txt"
    log "  2. Update docker-compose.yml to use SSL"
    log "  3. Configure applications to trust the CA certificate"
}

# Run main function
main "$@"
