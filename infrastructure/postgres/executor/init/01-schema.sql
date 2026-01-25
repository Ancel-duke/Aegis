-- =====================================================
-- Aegis Executor Database Schema
-- Action Audit Logs (Immutable)
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- ACTION_AUDIT_LOGS TABLE (Immutable)
-- =====================================================
CREATE TABLE IF NOT EXISTS action_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'restart_pod',
        'scale_deployment',
        'rollback_deployment',
        'delete_pod',
        'update_config'
    )),
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'pending',
        'in_progress',
        'completed',
        'failed',
        'rejected'
    )),
    namespace VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_name VARCHAR(255) NOT NULL,
    action_params JSONB NOT NULL,
    requested_by VARCHAR(255),
    policy_decision JSONB,
    execution_duration INTEGER,
    error_message TEXT,
    result JSONB,
    ip_address INET,
    signature TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Prevent updates and deletes (immutable table)
CREATE RULE action_audit_logs_no_update AS ON UPDATE TO action_audit_logs DO INSTEAD NOTHING;
CREATE RULE action_audit_logs_no_delete AS ON DELETE TO action_audit_logs DO INSTEAD NOTHING;

-- Indexes for audit log queries
CREATE INDEX idx_action_audit_logs_namespace ON action_audit_logs(namespace);
CREATE INDEX idx_action_audit_logs_action_type ON action_audit_logs(action_type);
CREATE INDEX idx_action_audit_logs_status ON action_audit_logs(status);
CREATE INDEX idx_action_audit_logs_created_at ON action_audit_logs(created_at DESC);
CREATE INDEX idx_action_audit_logs_requested_by ON action_audit_logs(requested_by);
CREATE INDEX idx_action_audit_logs_resource ON action_audit_logs(resource_type, resource_name);

-- Composite index for common queries
CREATE INDEX idx_action_audit_logs_namespace_created ON action_audit_logs(namespace, created_at DESC);
CREATE INDEX idx_action_audit_logs_type_status ON action_audit_logs(action_type, status, created_at DESC);

-- GIN index for JSONB fields
CREATE INDEX idx_action_audit_logs_action_params ON action_audit_logs USING gin(action_params);
CREATE INDEX idx_action_audit_logs_result ON action_audit_logs USING gin(result);
CREATE INDEX idx_action_audit_logs_policy_decision ON action_audit_logs USING gin(policy_decision);

-- =====================================================
-- ACTION_STATISTICS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS action_statistics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    count INTEGER DEFAULT 0,
    total_duration_ms BIGINT DEFAULT 0,
    avg_duration_ms NUMERIC(10, 2),
    min_duration_ms INTEGER,
    max_duration_ms INTEGER,
    UNIQUE(date, action_type, namespace, status)
);

-- Indexes for statistics queries
CREATE INDEX idx_action_statistics_date ON action_statistics(date DESC);
CREATE INDEX idx_action_statistics_type ON action_statistics(action_type);
CREATE INDEX idx_action_statistics_namespace ON action_statistics(namespace);

-- =====================================================
-- RATE_LIMIT_TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    requested_by VARCHAR(255) NOT NULL,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER DEFAULT 1,
    last_request_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(action_type, namespace, requested_by, window_start)
);

-- Index for rate limit checks
CREATE INDEX idx_rate_limit_tracking_window ON rate_limit_tracking(action_type, namespace, requested_by, window_end);

-- Cleanup expired rate limit windows
CREATE OR REPLACE FUNCTION cleanup_rate_limit_windows()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_tracking WHERE window_end < CURRENT_TIMESTAMP - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- EXECUTION_ERRORS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS execution_errors (
    id SERIAL PRIMARY KEY,
    audit_log_id UUID REFERENCES action_audit_logs(id),
    error_code VARCHAR(100),
    error_category VARCHAR(50) CHECK (error_category IN (
        'validation',
        'authorization',
        'kubernetes_api',
        'timeout',
        'network',
        'unknown'
    )),
    error_message TEXT NOT NULL,
    error_stack TEXT,
    recoverable BOOLEAN DEFAULT false,
    retry_count INTEGER DEFAULT 0,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for error analysis
CREATE INDEX idx_execution_errors_audit_log ON execution_errors(audit_log_id);
CREATE INDEX idx_execution_errors_category ON execution_errors(error_category);
CREATE INDEX idx_execution_errors_occurred ON execution_errors(occurred_at DESC);
CREATE INDEX idx_execution_errors_code ON execution_errors(error_code);

-- =====================================================
-- VIEWS
-- =====================================================

-- Recent actions view
CREATE OR REPLACE VIEW recent_actions AS
SELECT 
    id,
    action_type,
    status,
    namespace,
    resource_type,
    resource_name,
    requested_by,
    execution_duration,
    created_at,
    completed_at
FROM action_audit_logs
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Failed actions view
CREATE OR REPLACE VIEW failed_actions AS
SELECT 
    aal.id,
    aal.action_type,
    aal.namespace,
    aal.resource_name,
    aal.error_message,
    aal.requested_by,
    aal.created_at,
    ee.error_category,
    ee.recoverable
FROM action_audit_logs aal
LEFT JOIN execution_errors ee ON aal.id = ee.audit_log_id
WHERE aal.status = 'failed'
ORDER BY aal.created_at DESC;

-- Action statistics by namespace
CREATE OR REPLACE VIEW namespace_statistics AS
SELECT 
    namespace,
    action_type,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_actions,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_actions,
    AVG(execution_duration) FILTER (WHERE status = 'completed') as avg_duration_ms,
    MAX(created_at) as last_action_at
FROM action_audit_logs
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY namespace, action_type
ORDER BY total_actions DESC;

-- Actions by hour view
CREATE OR REPLACE VIEW actions_by_hour AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    action_type,
    status,
    COUNT(*) as count
FROM action_audit_logs
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at), action_type, status
ORDER BY hour DESC;

-- =====================================================
-- MATERIALIZED VIEWS
-- =====================================================

-- Daily action summary
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_action_summary AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    action_type,
    namespace,
    status,
    COUNT(*) as count,
    AVG(execution_duration) as avg_duration_ms,
    MIN(execution_duration) as min_duration_ms,
    MAX(execution_duration) as max_duration_ms,
    COUNT(DISTINCT requested_by) as unique_requesters
FROM action_audit_logs
GROUP BY DATE_TRUNC('day', created_at), action_type, namespace, status
ORDER BY date DESC;

CREATE UNIQUE INDEX ON daily_action_summary(date, action_type, namespace, status);

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION refresh_action_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_action_summary;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update action statistics on insert
CREATE OR REPLACE FUNCTION update_action_statistics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO action_statistics (
        date,
        action_type,
        namespace,
        status,
        count,
        total_duration_ms,
        avg_duration_ms,
        min_duration_ms,
        max_duration_ms
    )
    VALUES (
        DATE(NEW.created_at),
        NEW.action_type,
        NEW.namespace,
        NEW.status,
        1,
        COALESCE(NEW.execution_duration, 0),
        NEW.execution_duration,
        NEW.execution_duration,
        NEW.execution_duration
    )
    ON CONFLICT (date, action_type, namespace, status) 
    DO UPDATE SET
        count = action_statistics.count + 1,
        total_duration_ms = action_statistics.total_duration_ms + COALESCE(NEW.execution_duration, 0),
        avg_duration_ms = (action_statistics.total_duration_ms + COALESCE(NEW.execution_duration, 0)) / (action_statistics.count + 1),
        min_duration_ms = LEAST(action_statistics.min_duration_ms, NEW.execution_duration),
        max_duration_ms = GREATEST(action_statistics.max_duration_ms, NEW.execution_duration);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_action_statistics
AFTER INSERT ON action_audit_logs
FOR EACH ROW 
WHEN (NEW.status IN ('completed', 'failed'))
EXECUTE FUNCTION update_action_statistics();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Get action success rate
CREATE OR REPLACE FUNCTION get_action_success_rate(
    p_action_type VARCHAR DEFAULT NULL,
    p_namespace VARCHAR DEFAULT NULL,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    action_type VARCHAR,
    namespace VARCHAR,
    total_actions BIGINT,
    successful_actions BIGINT,
    failed_actions BIGINT,
    success_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        aal.action_type,
        aal.namespace,
        COUNT(*) as total_actions,
        COUNT(*) FILTER (WHERE aal.status = 'completed') as successful_actions,
        COUNT(*) FILTER (WHERE aal.status = 'failed') as failed_actions,
        ROUND(
            (COUNT(*) FILTER (WHERE aal.status = 'completed')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
            2
        ) as success_rate
    FROM action_audit_logs aal
    WHERE aal.created_at > CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
      AND (p_action_type IS NULL OR aal.action_type = p_action_type)
      AND (p_namespace IS NULL OR aal.namespace = p_namespace)
    GROUP BY aal.action_type, aal.namespace
    ORDER BY total_actions DESC;
END;
$$ LANGUAGE plpgsql;

-- Archive old audit logs
CREATE OR REPLACE FUNCTION archive_old_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- In production, this would move data to an archive table
    -- For now, we just count what would be archived
    SELECT COUNT(*) INTO archived_count
    FROM action_audit_logs
    WHERE created_at < CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PARTITIONING
-- =====================================================

-- Partition action_audit_logs by month (example for high-volume systems)
-- This should be implemented based on data volume requirements

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT ON action_audit_logs TO aegis_executor_user;
GRANT SELECT ON action_statistics TO aegis_executor_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_tracking TO aegis_executor_user;
GRANT SELECT, INSERT ON execution_errors TO aegis_executor_user;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO aegis_executor_user;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE action_audit_logs IS 'Immutable audit trail of all Kubernetes actions';
COMMENT ON TABLE action_statistics IS 'Aggregated statistics for action execution';
COMMENT ON TABLE rate_limit_tracking IS 'Rate limit tracking per action type and namespace';
COMMENT ON TABLE execution_errors IS 'Detailed error information for failed actions';

COMMENT ON COLUMN action_audit_logs.signature IS 'HMAC signature for action validation';
COMMENT ON COLUMN action_audit_logs.policy_decision IS 'Policy Engine decision that approved/denied this action';
