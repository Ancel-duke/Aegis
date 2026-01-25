-- =====================================================
-- Aegis AI Engine Database Schema
-- ML Predictions, Model Metrics, Training Data
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable TimescaleDB for time-series data (optional but recommended)
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =====================================================
-- PREDICTION_HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS prediction_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('anomaly', 'failure')),
    input_data JSONB NOT NULL,
    prediction JSONB NOT NULL,
    severity_score NUMERIC(5, 4) CHECK (severity_score >= 0 AND severity_score <= 1),
    confidence_score NUMERIC(5, 4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    recommended_action VARCHAR(100),
    actual_outcome VARCHAR(50),
    feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 5),
    execution_time_ms INTEGER,
    model_version VARCHAR(50),
    features JSONB,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for time-series queries
CREATE INDEX idx_prediction_history_timestamp ON prediction_history(timestamp DESC);
CREATE INDEX idx_prediction_history_model_type ON prediction_history(model_type);
CREATE INDEX idx_prediction_history_severity ON prediction_history(severity_score DESC);
CREATE INDEX idx_prediction_history_action ON prediction_history(recommended_action);

-- GIN index for JSON fields
CREATE INDEX idx_prediction_history_metadata ON prediction_history USING gin(metadata);
CREATE INDEX idx_prediction_history_features ON prediction_history USING gin(features);

-- Convert to hypertable for better time-series performance (TimescaleDB)
-- SELECT create_hypertable('prediction_history', 'timestamp', if_not_exists => TRUE);

-- =====================================================
-- MODEL_METRICS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS model_metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(10, 6) NOT NULL,
    dataset_size INTEGER,
    training_duration_seconds INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for model performance queries
CREATE INDEX idx_model_metrics_timestamp ON model_metrics(timestamp DESC);
CREATE INDEX idx_model_metrics_model_type ON model_metrics(model_type);
CREATE INDEX idx_model_metrics_metric_name ON model_metrics(metric_name);
CREATE INDEX idx_model_metrics_model_version ON model_metrics(model_version);

-- Composite index for common queries
CREATE INDEX idx_model_metrics_type_version ON model_metrics(model_type, model_version, timestamp DESC);

-- =====================================================
-- TRAINING_DATA TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS training_data (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    features JSONB NOT NULL,
    label INTEGER,
    source VARCHAR(100),
    is_validated BOOLEAN DEFAULT false,
    validation_score NUMERIC(5, 4),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for training data queries
CREATE INDEX idx_training_data_timestamp ON training_data(timestamp DESC);
CREATE INDEX idx_training_data_model_type ON training_data(model_type);
CREATE INDEX idx_training_data_label ON training_data(label);
CREATE INDEX idx_training_data_is_validated ON training_data(is_validated);

-- =====================================================
-- ANOMALY_DETECTIONS TABLE (Specific to anomaly detection)
-- =====================================================
CREATE TABLE IF NOT EXISTS anomaly_detections (
    id SERIAL PRIMARY KEY,
    prediction_id INTEGER REFERENCES prediction_history(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    anomaly_score NUMERIC(5, 4) NOT NULL CHECK (anomaly_score >= 0 AND anomaly_score <= 1),
    is_anomaly BOOLEAN NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    affected_metrics TEXT[],
    affected_services TEXT[],
    root_cause_analysis JSONB,
    recommended_actions JSONB DEFAULT '[]'::jsonb,
    false_positive BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT
);

-- Indexes for anomaly queries
CREATE INDEX idx_anomaly_detections_timestamp ON anomaly_detections(timestamp DESC);
CREATE INDEX idx_anomaly_detections_is_anomaly ON anomaly_detections(is_anomaly);
CREATE INDEX idx_anomaly_detections_severity ON anomaly_detections(severity);
CREATE INDEX idx_anomaly_detections_resolved ON anomaly_detections(resolved_at) WHERE resolved_at IS NOT NULL;

-- =====================================================
-- FAILURE_PREDICTIONS TABLE (Specific to failure prediction)
-- =====================================================
CREATE TABLE IF NOT EXISTS failure_predictions (
    id SERIAL PRIMARY KEY,
    prediction_id INTEGER REFERENCES prediction_history(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    failure_probability NUMERIC(5, 4) NOT NULL CHECK (failure_probability >= 0 AND failure_probability <= 1),
    failure_type VARCHAR(100),
    predicted_failure_time TIMESTAMP WITH TIME ZONE,
    affected_components TEXT[],
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    recommended_actions JSONB DEFAULT '[]'::jsonb,
    actual_failure_occurred BOOLEAN,
    actual_failure_time TIMESTAMP WITH TIME ZONE,
    prediction_accuracy NUMERIC(5, 4)
);

-- Indexes for failure prediction queries
CREATE INDEX idx_failure_predictions_timestamp ON failure_predictions(timestamp DESC);
CREATE INDEX idx_failure_predictions_probability ON failure_predictions(failure_probability DESC);
CREATE INDEX idx_failure_predictions_type ON failure_predictions(failure_type);
CREATE INDEX idx_failure_predictions_severity ON failure_predictions(severity);

-- =====================================================
-- FEATURE_STORE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS feature_store (
    id SERIAL PRIMARY KEY,
    feature_name VARCHAR(255) NOT NULL,
    feature_value NUMERIC NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    version INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(feature_name, entity_id, entity_type, timestamp)
);

-- Indexes for feature store queries
CREATE INDEX idx_feature_store_feature_name ON feature_store(feature_name);
CREATE INDEX idx_feature_store_entity ON feature_store(entity_id, entity_type);
CREATE INDEX idx_feature_store_timestamp ON feature_store(timestamp DESC);

-- Composite index for common queries
CREATE INDEX idx_feature_store_lookup ON feature_store(feature_name, entity_id, entity_type, timestamp DESC);

-- =====================================================
-- MODEL_REGISTRY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS model_registry (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(255) UNIQUE NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    version VARCHAR(50) NOT NULL,
    algorithm VARCHAR(100),
    hyperparameters JSONB DEFAULT '{}'::jsonb,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    training_date TIMESTAMP WITH TIME ZONE NOT NULL,
    deployed_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) CHECK (status IN ('training', 'deployed', 'retired')) DEFAULT 'training',
    model_path TEXT,
    created_by VARCHAR(255),
    notes TEXT,
    UNIQUE(model_name, version)
);

-- Indexes for model registry
CREATE INDEX idx_model_registry_type ON model_registry(model_type);
CREATE INDEX idx_model_registry_status ON model_registry(status);
CREATE INDEX idx_model_registry_deployed ON model_registry(deployed_date DESC) WHERE status = 'deployed';

-- =====================================================
-- VIEWS
-- =====================================================

-- Recent predictions view
CREATE OR REPLACE VIEW recent_predictions AS
SELECT 
    ph.id,
    ph.timestamp,
    ph.model_type,
    ph.recommended_action,
    ph.severity_score,
    ph.confidence_score,
    CASE 
        WHEN ad.id IS NOT NULL THEN 'anomaly'
        WHEN fp.id IS NOT NULL THEN 'failure'
        ELSE 'unknown'
    END as prediction_category
FROM prediction_history ph
LEFT JOIN anomaly_detections ad ON ph.id = ad.prediction_id
LEFT JOIN failure_predictions fp ON ph.id = fp.prediction_id
WHERE ph.timestamp > CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY ph.timestamp DESC;

-- Model performance summary
CREATE OR REPLACE VIEW model_performance_summary AS
SELECT 
    model_type,
    model_version,
    COUNT(*) as total_predictions,
    AVG(confidence_score) as avg_confidence,
    AVG(execution_time_ms) as avg_execution_time_ms,
    DATE_TRUNC('hour', timestamp) as hour
FROM prediction_history
WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY model_type, model_version, DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;

-- Active anomalies view
CREATE OR REPLACE VIEW active_anomalies AS
SELECT 
    ad.id,
    ad.timestamp,
    ad.severity,
    ad.affected_metrics,
    ad.affected_services,
    ad.recommended_actions,
    ph.input_data
FROM anomaly_detections ad
JOIN prediction_history ph ON ad.prediction_id = ph.id
WHERE ad.is_anomaly = true 
  AND ad.resolved_at IS NULL
  AND ad.false_positive = false
ORDER BY ad.severity DESC, ad.timestamp DESC;

-- =====================================================
-- MATERIALIZED VIEWS (for faster aggregations)
-- =====================================================

-- Daily prediction statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_prediction_stats AS
SELECT 
    DATE_TRUNC('day', timestamp) as date,
    model_type,
    COUNT(*) as total_predictions,
    AVG(confidence_score) as avg_confidence,
    AVG(severity_score) as avg_severity,
    COUNT(DISTINCT recommended_action) as unique_actions,
    AVG(execution_time_ms) as avg_execution_time
FROM prediction_history
GROUP BY DATE_TRUNC('day', timestamp), model_type
ORDER BY date DESC;

CREATE UNIQUE INDEX ON daily_prediction_stats(date, model_type);

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION refresh_prediction_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_prediction_stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Automatically mark resolved anomalies
CREATE OR REPLACE FUNCTION mark_anomaly_resolved()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.resolved_at IS NOT NULL AND OLD.resolved_at IS NULL THEN
        NEW.false_positive = false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mark_anomaly_resolved 
BEFORE UPDATE ON anomaly_detections
FOR EACH ROW EXECUTE FUNCTION mark_anomaly_resolved();

-- =====================================================
-- PARTITIONING (for large datasets)
-- =====================================================

-- Partition prediction_history by month (example)
-- This should be set up based on data volume requirements

-- =====================================================
-- DATA RETENTION POLICIES
-- =====================================================

-- Function to archive old predictions
CREATE OR REPLACE FUNCTION archive_old_predictions(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM prediction_history
    WHERE timestamp < CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL
      AND actual_outcome IS NOT NULL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON prediction_history TO aegis_ai_user;
GRANT SELECT, INSERT ON model_metrics TO aegis_ai_user;
GRANT SELECT, INSERT, UPDATE ON training_data TO aegis_ai_user;
GRANT SELECT, INSERT, UPDATE ON anomaly_detections TO aegis_ai_user;
GRANT SELECT, INSERT, UPDATE ON failure_predictions TO aegis_ai_user;
GRANT SELECT, INSERT, UPDATE ON feature_store TO aegis_ai_user;
GRANT SELECT, INSERT, UPDATE ON model_registry TO aegis_ai_user;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO aegis_ai_user;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE prediction_history IS 'Historical record of all ML predictions';
COMMENT ON TABLE model_metrics IS 'Performance metrics for ML models';
COMMENT ON TABLE training_data IS 'Dataset for model training and retraining';
COMMENT ON TABLE anomaly_detections IS 'Specific anomaly detection results';
COMMENT ON TABLE failure_predictions IS 'Specific failure prediction results';
COMMENT ON TABLE feature_store IS 'Feature engineering pipeline output';
COMMENT ON TABLE model_registry IS 'Registry of all ML models and versions';
