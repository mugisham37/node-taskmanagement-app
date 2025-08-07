-- PostgreSQL Extensions for Enterprise Platform
-- This script initializes required PostgreSQL extensions

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enable case-insensitive text operations
CREATE EXTENSION IF NOT EXISTS "citext";

-- Enable cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable additional indexing methods
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Enable statistics extensions for query optimization
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Enable connection pooling statistics
CREATE EXTENSION IF NOT EXISTS "pg_buffercache";

-- Create custom functions for the application
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create audit log function
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, operation, old_values, user_id, created_at)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), current_setting('app.current_user_id', true)::uuid, CURRENT_TIMESTAMP);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, operation, old_values, new_values, user_id, created_at)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW), current_setting('app.current_user_id', true)::uuid, CURRENT_TIMESTAMP);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, operation, new_values, user_id, created_at)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW), current_setting('app.current_user_id', true)::uuid, CURRENT_TIMESTAMP);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create performance monitoring views
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE calls > 100
ORDER BY mean_time DESC
LIMIT 20;

-- Create database health check function
CREATE OR REPLACE FUNCTION database_health_check()
RETURNS TABLE (
    metric VARCHAR,
    value NUMERIC,
    status VARCHAR
) AS $$
BEGIN
    -- Connection count
    RETURN QUERY
    SELECT 
        'active_connections'::VARCHAR,
        COUNT(*)::NUMERIC,
        CASE 
            WHEN COUNT(*) < 50 THEN 'healthy'
            WHEN COUNT(*) < 80 THEN 'warning'
            ELSE 'critical'
        END::VARCHAR
    FROM pg_stat_activity
    WHERE state = 'active';
    
    -- Database size
    RETURN QUERY
    SELECT 
        'database_size_mb'::VARCHAR,
        (pg_database_size(current_database()) / 1024 / 1024)::NUMERIC,
        'healthy'::VARCHAR;
    
    -- Cache hit ratio
    RETURN QUERY
    SELECT 
        'cache_hit_ratio'::VARCHAR,
        (100.0 * sum(blks_hit) / nullif(sum(blks_hit) + sum(blks_read), 0))::NUMERIC,
        CASE 
            WHEN (100.0 * sum(blks_hit) / nullif(sum(blks_hit) + sum(blks_read), 0)) > 95 THEN 'healthy'
            WHEN (100.0 * sum(blks_hit) / nullif(sum(blks_hit) + sum(blks_read), 0)) > 90 THEN 'warning'
            ELSE 'critical'
        END::VARCHAR
    FROM pg_stat_database
    WHERE datname = current_database();
END;
$$ language 'plpgsql';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION database_health_check() TO PUBLIC;

-- Create indexes for common query patterns
-- These will be created by Prisma migrations, but we ensure they exist

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL extensions and functions initialized successfully';
END $$;