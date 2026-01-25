-- =====================================================
-- Aegis Backend Database Schema
-- Users, Roles, Policies, Policy Audit Logs
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for role name lookups
CREATE INDEX idx_roles_name ON roles(name);

-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES
    ('admin', 'Administrator with full access', '["*"]'::jsonb),
    ('user', 'Standard user with limited access', '["read:own", "write:own"]'::jsonb),
    ('auditor', 'Read-only access for auditing', '["read:*"]'::jsonb),
    ('service', 'Service account for automated operations', '["read:*", "write:policies"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    refresh_token VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Indexes for user queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Full-text search index
CREATE INDEX idx_users_name_search ON users USING gin(
    to_tsvector('english', first_name || ' ' || last_name)
);

-- =====================================================
-- USER_ROLES TABLE (Many-to-Many)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    UNIQUE(user_id, role_id)
);

-- Indexes for efficient joins
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- =====================================================
-- POLICIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    effect VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
    actions TEXT[] NOT NULL,
    resources TEXT[] NOT NULL,
    conditions JSONB DEFAULT '{}'::jsonb,
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Indexes for policy evaluation
CREATE INDEX idx_policies_effect ON policies(effect);
CREATE INDEX idx_policies_is_active ON policies(is_active);
CREATE INDEX idx_policies_priority ON policies(priority DESC);
CREATE INDEX idx_policies_actions ON policies USING gin(actions);
CREATE INDEX idx_policies_resources ON policies USING gin(resources);
CREATE INDEX idx_policies_conditions ON policies USING gin(conditions);

-- =====================================================
-- POLICY_AUDIT_LOGS TABLE (Immutable)
-- =====================================================
CREATE TABLE IF NOT EXISTS policy_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    resource TEXT NOT NULL,
    result VARCHAR(10) NOT NULL CHECK (result IN ('allow', 'deny')),
    applied_policies JSONB DEFAULT '[]'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Prevent updates and deletes (immutable table)
CREATE RULE policy_audit_logs_no_update AS ON UPDATE TO policy_audit_logs DO INSTEAD NOTHING;
CREATE RULE policy_audit_logs_no_delete AS ON DELETE TO policy_audit_logs DO INSTEAD NOTHING;

-- Indexes for audit log queries
CREATE INDEX idx_policy_audit_logs_user_id ON policy_audit_logs(user_id);
CREATE INDEX idx_policy_audit_logs_action ON policy_audit_logs(action);
CREATE INDEX idx_policy_audit_logs_result ON policy_audit_logs(result);
CREATE INDEX idx_policy_audit_logs_created_at ON policy_audit_logs(created_at DESC);
CREATE INDEX idx_policy_audit_logs_context ON policy_audit_logs USING gin(context);

-- Partition by month for better query performance
-- This should be set up as needed based on data volume

-- =====================================================
-- SESSION_CACHE TABLE (for Redis fallback)
-- =====================================================
CREATE TABLE IF NOT EXISTS session_cache (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for expiration cleanup
CREATE INDEX idx_session_cache_expires_at ON session_cache(expires_at);

-- Cleanup expired sessions function
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM session_cache WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS
-- =====================================================

-- User with roles view
CREATE OR REPLACE VIEW users_with_roles AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.is_active,
    u.created_at,
    u.last_login,
    COALESCE(
        json_agg(
            json_build_object(
                'id', r.id,
                'name', r.name,
                'permissions', r.permissions
            )
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'::json
    ) as roles
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
GROUP BY u.id, u.email, u.first_name, u.last_name, u.is_active, u.created_at, u.last_login;

-- Active policies view
CREATE OR REPLACE VIEW active_policies AS
SELECT 
    id,
    name,
    description,
    effect,
    actions,
    resources,
    conditions,
    priority
FROM policies
WHERE is_active = true
ORDER BY priority DESC;

-- Policy evaluation statistics view
CREATE OR REPLACE VIEW policy_evaluation_stats AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    result,
    COUNT(*) as count,
    COUNT(DISTINCT user_id) as unique_users
FROM policy_audit_logs
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), result
ORDER BY hour DESC;

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant appropriate permissions to application user
GRANT SELECT, INSERT, UPDATE ON users TO aegis_backend_user;
GRANT SELECT ON roles TO aegis_backend_user;
GRANT SELECT, INSERT ON user_roles TO aegis_backend_user;
GRANT SELECT, INSERT, UPDATE ON policies TO aegis_backend_user;
GRANT INSERT ON policy_audit_logs TO aegis_backend_user;
GRANT SELECT ON policy_audit_logs TO aegis_backend_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON session_cache TO aegis_backend_user;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO aegis_backend_user;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE users IS 'User accounts with authentication credentials';
COMMENT ON TABLE roles IS 'RBAC roles with associated permissions';
COMMENT ON TABLE user_roles IS 'Many-to-many relationship between users and roles';
COMMENT ON TABLE policies IS 'Policy definitions for access control and self-healing decisions';
COMMENT ON TABLE policy_audit_logs IS 'Immutable audit trail of all policy evaluations';
COMMENT ON TABLE session_cache IS 'Fallback cache for sessions when Redis is unavailable';

COMMENT ON COLUMN users.refresh_token IS 'Hashed refresh token for JWT rotation';
COMMENT ON COLUMN policies.effect IS 'Allow or deny - deny takes precedence';
COMMENT ON COLUMN policies.priority IS 'Higher number = higher priority (evaluated first)';
COMMENT ON COLUMN policies.conditions IS 'JSON conditions for policy evaluation (roles, time, metadata)';
