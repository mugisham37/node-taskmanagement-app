-- Comprehensive Database Constraints for Domain Rule Enforcement
-- This migration adds check constraints and additional business rule enforcement

-- User constraints
ALTER TABLE users ADD CONSTRAINT check_email_format 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE users ADD CONSTRAINT check_failed_login_attempts 
    CHECK (failed_login_attempts >= 0 AND failed_login_attempts <= 10);

ALTER TABLE users ADD CONSTRAINT check_risk_score 
    CHECK (risk_score >= 0.0 AND risk_score <= 10.0);

-- Workspace constraints
ALTER TABLE workspaces ADD CONSTRAINT check_member_limit 
    CHECK (member_limit > 0 OR member_limit = -1);

ALTER TABLE workspaces ADD CONSTRAINT check_project_limit 
    CHECK (project_limit > 0 OR project_limit = -1);

ALTER TABLE workspaces ADD CONSTRAINT check_storage_limit 
    CHECK (storage_limit_gb > 0);

ALTER TABLE workspaces ADD CONSTRAINT check_subscription_tier 
    CHECK (subscription_tier IN ('free', 'basic', 'professional', 'enterprise'));

-- Project constraints
ALTER TABLE projects ADD CONSTRAINT check_project_dates 
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);

ALTER TABLE projects ADD CONSTRAINT check_budget_amount 
    CHECK (budget_amount IS NULL OR budget_amount >= 0);

ALTER TABLE projects ADD CONSTRAINT check_color_format 
    CHECK (color ~* '^#[0-9A-F]{6}$');

-- Task constraints
ALTER TABLE tasks ADD CONSTRAINT check_task_dates 
    CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date);

ALTER TABLE tasks ADD CONSTRAINT check_estimated_hours 
    CHECK (estimated_hours IS NULL OR estimated_hours >= 0);

ALTER TABLE tasks ADD CONSTRAINT check_actual_hours 
    CHECK (actual_hours IS NULL OR actual_hours >= 0);

ALTER TABLE tasks ADD CONSTRAINT check_story_points 
    CHECK (story_points IS NULL OR story_points >= 0);

ALTER TABLE tasks ADD CONSTRAINT check_position 
    CHECK (position >= 0);

ALTER TABLE tasks ADD CONSTRAINT check_title_length 
    CHECK (LENGTH(title) > 0 AND LENGTH(title) <= 500);

-- Prevent self-referential task relationships
ALTER TABLE tasks ADD CONSTRAINT check_not_self_epic 
    CHECK (id != epic_id);

ALTER TABLE tasks ADD CONSTRAINT check_not_self_parent 
    CHECK (id != parent_task_id);

-- Task dependency constraints
ALTER TABLE task_dependencies ADD CONSTRAINT check_not_self_dependency 
    CHECK (task_id != depends_on_id);

-- Time entry constraints
ALTER TABLE time_entries ADD CONSTRAINT check_time_entry_duration 
    CHECK (duration IS NULL OR duration >= 0);

ALTER TABLE time_entries ADD CONSTRAINT check_time_entry_dates 
    CHECK (end_time IS NULL OR start_time <= end_time);

-- File constraints
ALTER TABLE files ADD CONSTRAINT check_file_size 
    CHECK (size > 0);

ALTER TABLE files ADD CONSTRAINT check_current_version 
    CHECK (current_version >= 1);

ALTER TABLE files ADD CONSTRAINT check_compression_ratio 
    CHECK (compression_ratio IS NULL OR (compression_ratio >= 0 AND compression_ratio <= 1));

ALTER TABLE files ADD CONSTRAINT check_virus_scan_status 
    CHECK (virus_scan_status IN ('pending', 'clean', 'infected', 'error'));

-- File version constraints
ALTER TABLE file_versions ADD CONSTRAINT check_file_version_number 
    CHECK (version >= 1);

ALTER TABLE file_versions ADD CONSTRAINT check_file_version_size 
    CHECK (size > 0);

-- Webhook constraints
ALTER TABLE webhooks ADD CONSTRAINT check_webhook_timeout 
    CHECK (timeout > 0 AND timeout <= 300000); -- Max 5 minutes

ALTER TABLE webhooks ADD CONSTRAINT check_webhook_retries 
    CHECK (max_retries >= 0 AND max_retries <= 10);

ALTER TABLE webhooks ADD CONSTRAINT check_webhook_delay 
    CHECK (retry_delay >= 0);

ALTER TABLE webhooks ADD CONSTRAINT check_webhook_counts 
    CHECK (success_count >= 0 AND failure_count >= 0);

ALTER TABLE webhooks ADD CONSTRAINT check_webhook_url_format 
    CHECK (url ~* '^https?://');

-- Webhook delivery constraints
ALTER TABLE webhook_deliveries ADD CONSTRAINT check_attempt_count 
    CHECK (attempt_count >= 0);

ALTER TABLE webhook_deliveries ADD CONSTRAINT check_max_attempts 
    CHECK (max_attempts >= 0);

ALTER TABLE webhook_deliveries ADD CONSTRAINT check_http_status_code 
    CHECK (http_status_code IS NULL OR (http_status_code >= 100 AND http_status_code <= 599));

ALTER TABLE webhook_deliveries ADD CONSTRAINT check_duration 
    CHECK (duration IS NULL OR duration >= 0);

-- Search analytics constraints
ALTER TABLE search_analytics ADD CONSTRAINT check_result_count 
    CHECK (result_count >= 0);

ALTER TABLE search_analytics ADD CONSTRAINT check_response_time 
    CHECK (response_time >= 0);

-- Additional business rule constraints
-- Ensure workspace members don't exceed workspace limits
CREATE OR REPLACE FUNCTION check_workspace_member_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM workspace_members 
        WHERE workspace_id = NEW.workspace_id AND status = 'ACTIVE') >= 
       (SELECT member_limit FROM workspaces 
        WHERE id = NEW.workspace_id AND member_limit != -1) THEN
        RAISE EXCEPTION 'Workspace member limit exceeded';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_workspace_member_limit
    BEFORE INSERT OR UPDATE ON workspace_members
    FOR EACH ROW EXECUTE FUNCTION check_workspace_member_limit();

-- Ensure projects don't exceed workspace limits
CREATE OR REPLACE FUNCTION check_workspace_project_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM projects 
        WHERE workspace_id = NEW.workspace_id AND deleted_at IS NULL) >= 
       (SELECT project_limit FROM workspaces 
        WHERE id = NEW.workspace_id AND project_limit != -1) THEN
        RAISE EXCEPTION 'Workspace project limit exceeded';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_workspace_project_limit
    BEFORE INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION check_workspace_project_limit();

-- Ensure task completion date is set when status is DONE
CREATE OR REPLACE FUNCTION check_task_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'DONE' AND NEW.completed_at IS NULL THEN
        NEW.completed_at = NOW();
    ELSIF NEW.status != 'DONE' AND OLD.status = 'DONE' THEN
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_task_completion
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION check_task_completion();

-- Update last_activity_at on task changes
CREATE OR REPLACE FUNCTION update_task_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_activity
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_task_activity();

-- Ensure file virus scan is performed
CREATE OR REPLACE FUNCTION check_file_virus_scan()
RETURNS TRIGGER AS $$
BEGIN
    -- Set virus scan date when status changes from pending
    IF OLD.virus_scan_status = 'pending' AND NEW.virus_scan_status != 'pending' THEN
        NEW.virus_scan_date = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_file_virus_scan
    BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION check_file_virus_scan();

-- Create indexes for foreign key relationships to improve performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_workspace_id ON users(active_workspace_id) WHERE active_workspace_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_workspace_id ON sessions(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_device_id ON sessions(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webauthn_credentials_user_id ON webauthn_credentials(user_id);

-- Partial indexes for better performance on filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active ON users(id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_active ON workspaces(id) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_active ON projects(id) WHERE is_archived = false AND deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_active ON tasks(id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_incomplete ON tasks(id) WHERE status != 'DONE' AND status != 'CANCELLED' AND deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_overdue ON tasks(id) WHERE due_date < NOW() AND status != 'DONE' AND status != 'CANCELLED' AND deleted_at IS NULL;

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_active ON workspace_members(workspace_id, user_id) WHERE status = 'ACTIVE';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_members_active ON project_members(project_id, user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_active ON team_members(team_id, user_id);

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_title_gin ON tasks USING gin(to_tsvector('english', title)) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_description_gin ON tasks USING gin(to_tsvector('english', description)) WHERE description IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_name_gin ON projects USING gin(to_tsvector('english', name)) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_content_gin ON comments USING gin(to_tsvector('english', content)) WHERE deleted_at IS NULL;

-- Array indexes for tags and labels
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_tags_gin ON tasks USING gin(tags) WHERE array_length(tags, 1) > 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_labels_gin ON tasks USING gin(labels) WHERE array_length(labels, 1) > 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_watchers_gin ON tasks USING gin(watchers) WHERE array_length(watchers, 1) > 0;

-- JSON indexes for custom fields and metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_custom_fields_gin ON tasks USING gin(custom_fields) WHERE custom_fields != '{}';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_metadata_gin ON files USING gin(metadata) WHERE metadata != '{}';

-- Statistics and analytics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_created_at_desc ON activities(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_at_desc ON audit_logs(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at_desc ON notifications(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_start_time_desc ON time_entries(start_time DESC);

-- Performance monitoring views
CREATE OR REPLACE VIEW task_performance_stats AS
SELECT 
    workspace_id,
    project_id,
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE status = 'DONE') as completed_tasks,
    COUNT(*) FILTER (WHERE status = 'TODO') as pending_tasks,
    COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_tasks,
    COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('DONE', 'CANCELLED')) as overdue_tasks,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) FILTER (WHERE completed_at IS NOT NULL) as avg_completion_hours,
    AVG(actual_hours) FILTER (WHERE actual_hours IS NOT NULL) as avg_actual_hours,
    AVG(estimated_hours) FILTER (WHERE estimated_hours IS NOT NULL) as avg_estimated_hours
FROM tasks 
WHERE deleted_at IS NULL
GROUP BY workspace_id, project_id;

CREATE OR REPLACE VIEW workspace_activity_stats AS
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    COUNT(DISTINCT wm.user_id) as active_members,
    COUNT(DISTINCT p.id) as total_projects,
    COUNT(DISTINCT t.id) as total_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'DONE') as completed_tasks,
    COUNT(DISTINCT a.id) FILTER (WHERE a.created_at >= NOW() - INTERVAL '30 days') as recent_activities
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.status = 'ACTIVE'
LEFT JOIN projects p ON w.id = p.workspace_id AND p.deleted_at IS NULL
LEFT JOIN tasks t ON w.id = t.workspace_id AND t.deleted_at IS NULL
LEFT JOIN activities a ON w.id = a.workspace_id
WHERE w.deleted_at IS NULL AND w.is_active = true
GROUP BY w.id, w.name;

-- Add comments for documentation
COMMENT ON TABLE users IS 'Core user accounts with authentication and profile information';
COMMENT ON TABLE workspaces IS 'Multi-tenant workspaces containing projects and tasks';
COMMENT ON TABLE projects IS 'Project containers for organizing tasks and team collaboration';
COMMENT ON TABLE tasks IS 'Individual work items with assignments, due dates, and tracking';
COMMENT ON TABLE activities IS 'Audit trail of all user actions and system events';
COMMENT ON TABLE files IS 'File storage with versioning, security scanning, and access control';

-- Performance optimization settings
-- These should be applied by a DBA based on system resources
-- ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
-- ALTER SYSTEM SET track_activity_query_size = 2048;
-- ALTER SYSTEM SET log_min_duration_statement = 1000;
-- ALTER SYSTEM SET log_checkpoints = on;
-- ALTER SYSTEM SET log_connections = on;
-- ALTER SYSTEM SET log_disconnections = on;
-- ALTER SYSTEM SET log_lock_waits = on;