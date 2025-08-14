-- Initialize test database with required extensions and optimizations

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create test-specific database settings for performance
ALTER DATABASE unified_enterprise_platform_test SET shared_preload_libraries = 'pg_stat_statements';
ALTER DATABASE unified_enterprise_platform_test SET log_statement = 'none';
ALTER DATABASE unified_enterprise_platform_test SET log_min_duration_statement = -1;
ALTER DATABASE unified_enterprise_platform_test SET checkpoint_completion_target = 0.9;
ALTER DATABASE unified_enterprise_platform_test SET wal_buffers = '16MB';
ALTER DATABASE unified_enterprise_platform_test SET effective_cache_size = '256MB';
ALTER DATABASE unified_enterprise_platform_test SET shared_buffers = '128MB';

-- Create test-specific roles and permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'test_user') THEN
        CREATE ROLE test_user WITH LOGIN PASSWORD 'test_password';
    END IF;
END
$$;

-- Grant necessary permissions to test user
GRANT CONNECT ON DATABASE unified_enterprise_platform_test TO test_user;
GRANT USAGE ON SCHEMA public TO test_user;
GRANT CREATE ON SCHEMA public TO test_user;

-- Create test-specific functions for data cleanup
CREATE OR REPLACE FUNCTION truncate_all_tables()
RETURNS void AS $$
DECLARE
    table_name text;
BEGIN
    -- Disable foreign key checks temporarily
    SET session_replication_role = replica;
    
    -- Truncate all tables except system tables
    FOR table_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE '_prisma_%'
    LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(table_name) || ' RESTART IDENTITY CASCADE';
    END LOOP;
    
    -- Re-enable foreign key checks
    SET session_replication_role = DEFAULT;
END;
$$ LANGUAGE plpgsql;

-- Create function to reset sequences
CREATE OR REPLACE FUNCTION reset_all_sequences()
RETURNS void AS $$
DECLARE
    seq_name text;
BEGIN
    FOR seq_name IN 
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE 'ALTER SEQUENCE ' || quote_ident(seq_name) || ' RESTART WITH 1';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to analyze all tables for better query planning
CREATE OR REPLACE FUNCTION analyze_all_tables()
RETURNS void AS $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ANALYZE ' || quote_ident(table_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create test data validation functions
CREATE OR REPLACE FUNCTION validate_foreign_keys()
RETURNS TABLE(table_name text, constraint_name text, is_valid boolean) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tc.table_name::text,
        tc.constraint_name::text,
        (NOT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints tc2
            WHERE tc2.constraint_name = tc.constraint_name
            AND tc2.constraint_type = 'FOREIGN KEY'
        )) as is_valid
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';
END;
$$ LANGUAGE plpgsql;

-- Create function to check data integrity
CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE(check_name text, status text, details text) AS $$
BEGIN
    -- Check for orphaned records
    RETURN QUERY
    SELECT 
        'orphaned_tasks'::text as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'::text
            ELSE 'FAIL'::text
        END as status,
        CONCAT('Found ', COUNT(*), ' orphaned tasks')::text as details
    FROM "Task" t
    LEFT JOIN "Project" p ON t."projectId" = p.id
    WHERE p.id IS NULL AND t."projectId" IS NOT NULL;

    -- Check for orphaned projects
    RETURN QUERY
    SELECT 
        'orphaned_projects'::text as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'::text
            ELSE 'FAIL'::text
        END as status,
        CONCAT('Found ', COUNT(*), ' orphaned projects')::text as details
    FROM "Project" p
    LEFT JOIN "Workspace" w ON p."workspaceId" = w.id
    WHERE w.id IS NULL;

    -- Check for invalid user references
    RETURN QUERY
    SELECT 
        'invalid_user_refs'::text as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'::text
            ELSE 'FAIL'::text
        END as status,
        CONCAT('Found ', COUNT(*), ' invalid user references')::text as details
    FROM "Task" t
    LEFT JOIN "User" u ON t."assigneeId" = u.id
    WHERE t."assigneeId" IS NOT NULL AND u.id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better test performance
CREATE INDEX IF NOT EXISTS idx_test_user_email ON "User"("email");
CREATE INDEX IF NOT EXISTS idx_test_workspace_slug ON "Workspace"("slug");
CREATE INDEX IF NOT EXISTS idx_test_task_status ON "Task"("status");
CREATE INDEX IF NOT EXISTS idx_test_task_priority ON "Task"("priority");
CREATE INDEX IF NOT EXISTS idx_test_task_assignee ON "Task"("assigneeId");
CREATE INDEX IF NOT EXISTS idx_test_task_creator ON "Task"("creatorId");
CREATE INDEX IF NOT EXISTS idx_test_task_project ON "Task"("projectId");
CREATE INDEX IF NOT EXISTS idx_test_task_workspace ON "Task"("workspaceId");

-- Create test-specific views for common queries
CREATE OR REPLACE VIEW test_user_summary AS
SELECT 
    u.id,
    u.email,
    u.name,
    u."emailVerified",
    u."mfaEnabled",
    u."activeWorkspaceId",
    COUNT(DISTINCT wm.id) as workspace_count,
    COUNT(DISTINCT t.id) as task_count
FROM "User" u
LEFT JOIN "WorkspaceMember" wm ON u.id = wm."userId"
LEFT JOIN "Task" t ON u.id = t."assigneeId"
GROUP BY u.id, u.email, u.name, u."emailVerified", u."mfaEnabled", u."activeWorkspaceId";

CREATE OR REPLACE VIEW test_workspace_summary AS
SELECT 
    w.id,
    w.name,
    w.slug,
    w."ownerId",
    w."subscriptionTier",
    w."isActive",
    COUNT(DISTINCT wm.id) as member_count,
    COUNT(DISTINCT p.id) as project_count,
    COUNT(DISTINCT t.id) as task_count
FROM "Workspace" w
LEFT JOIN "WorkspaceMember" wm ON w.id = wm."workspaceId"
LEFT JOIN "Project" p ON w.id = p."workspaceId"
LEFT JOIN "Task" t ON w.id = t."workspaceId"
GROUP BY w.id, w.name, w.slug, w."ownerId", w."subscriptionTier", w."isActive";

-- Grant permissions on test functions and views
GRANT EXECUTE ON FUNCTION truncate_all_tables() TO test_user;
GRANT EXECUTE ON FUNCTION reset_all_sequences() TO test_user;
GRANT EXECUTE ON FUNCTION analyze_all_tables() TO test_user;
GRANT EXECUTE ON FUNCTION validate_foreign_keys() TO test_user;
GRANT EXECUTE ON FUNCTION check_data_integrity() TO test_user;
GRANT SELECT ON test_user_summary TO test_user;
GRANT SELECT ON test_workspace_summary TO test_user;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Test database initialized successfully with extensions and optimizations';
END
$$;