-- Comprehensive Database Indexes and Constraints for Enterprise Platform
-- This migration adds performance-optimized indexes and business rule constraints

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- User performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_workspace_activity ON users(active_workspace_id, last_login_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_security_risk ON users(risk_score DESC, failed_login_attempts DESC);

-- Workspace performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_owner_active ON workspaces(owner_id, is_active, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_subscription_active ON workspaces(subscription_tier, is_active, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_slug_active ON workspaces(slug) WHERE deleted_at IS NULL;

-- Project performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_workspace_status_priority ON projects(workspace_id, status, priority, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_owner_status ON projects(owner_id, status, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_timeline ON projects(start_date, end_date) WHERE start_date IS NOT NULL AND end_date IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_budget ON projects(budget_amount DESC) WHERE budget_amount IS NOT NULL;

-- Task performance indexes (most critical for performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_workspace_status_priority ON tasks(workspace_id, status, priority, due_date ASC NULLS LAST);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_status_position ON tasks(project_id, status, position ASC) WHERE project_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assignee_status_due ON tasks(assignee_id, status, due_date ASC NULLS LAST) WHERE assignee_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_creator_activity ON tasks(creator_id, last_activity_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_overdue ON tasks(due_date, status) WHERE due_date < NOW() AND status NOT IN ('DONE', 'CANCELLED');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_epic_hierarchy ON tasks(epic_id, parent_task_id, position ASC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_recurring ON tasks(recurring_task_id, recurrence_instance_date) WHERE recurring_task_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_tags_gin ON tasks USING gin(tags);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_labels_gin ON tasks USING gin(labels);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_watchers_gin ON tasks USING gin(watchers);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_full_text ON tasks USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Team and membership indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_active ON workspace_members(workspace_id, status, last_active_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_members_role ON project_members(project_id, role, added_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_active ON team_members(team_id, role, joined_at DESC);

-- Activity and audit indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_workspace_type_time ON activities(workspace_id, type, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_time ON activities(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_task_time ON activities(task_id, created_at DESC) WHERE task_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_time ON audit_logs(resource, resource_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC) WHERE user_id IS NOT NULL;

-- Comment and collaboration indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_task_time ON comments(task_id, created_at DESC) WHERE task_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_project_time ON comments(project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_author_time ON comments(author_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_mentions_gin ON comments USING gin(mentions);

-- Time tracking indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_task_user ON time_entries(task_id, user_id, start_time DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_user_time_range ON time_entries(user_id, start_time DESC, end_time DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_duration ON time_entries(duration DESC) WHERE duration IS NOT NULL;

-- Notification indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_workspace_type ON notifications(workspace_id, type, created_at DESC) WHERE workspace_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_delivery ON notifications(delivered_at, expires_at) WHERE delivered_at IS NOT NULL;

-- File management indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_workspace_type ON files(workspace_id, mime_type, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_uploader_time ON files(uploaded_by, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_virus_scan ON files(virus_scan_status, virus_scan_date) WHERE virus_scan_status != 'clean';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_size_type ON files(size DESC, mime_type);

-- Search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_index_workspace_entity ON search_index(workspace_id, entity_type, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_index_permissions_gin ON search_index USING gin(permissions);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_index_tags_gin ON search_index USING gin(tags);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_index_full_text ON search_index USING gin(to_tsvector('english', title || ' ' || content));

-- ============================================================================
-- BUSINESS RULE CONSTRAINTS
-- ============================================================================

-- User constraints
ALTER TABLE users ADD CONSTRAINT chk_users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
ALTER TABLE users ADD CONSTRAINT chk_users_failed_attempts CHECK (failed_login_attempts >= 0 AND failed_login_attempts <= 10);
ALTER TABLE users ADD CONSTRAINT chk_users_risk_score CHECK (risk_score >= 0.0 AND risk_score <= 1.0);

-- Workspace constraints
ALTER TABLE workspaces ADD CONSTRAINT chk_workspaces_member_limit CHECK (member_limit > 0 AND member_limit <= 10000);
ALTER TABLE workspaces ADD CONSTRAINT chk_workspaces_project_limit CHECK (project_limit > 0 AND project_limit <= 1000);
ALTER TABLE workspaces ADD CONSTRAINT chk_workspaces_storage_limit CHECK (storage_limit_gb > 0 AND storage_limit_gb <= 10000);
ALTER TABLE workspaces ADD CONSTRAINT chk_workspaces_subscription_tier CHECK (subscription_tier IN ('free', 'pro', 'enterprise'));

-- Project constraints
ALTER TABLE projects ADD CONSTRAINT chk_projects_timeline CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);
ALTER TABLE projects ADD CONSTRAINT chk_projects_budget CHECK (budget_amount IS NULL OR budget_amount >= 0);
ALTER TABLE projects ADD CONSTRAINT chk_projects_status CHECK (status IN ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'));
ALTER TABLE projects ADD CONSTRAINT chk_projects_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT'));

-- Task constraints
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 500);
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_timeline CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date);
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_effort CHECK (
  (estimated_hours IS NULL OR estimated_hours >= 0) AND
  (actual_hours IS NULL OR actual_hours >= 0) AND
  (story_points IS NULL OR (story_points >= 0 AND story_points <= 100))
);
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_status CHECK (status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'));
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT'));
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_position CHECK (position >= 0);
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_no_self_parent CHECK (id != parent_task_id);
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_no_self_epic CHECK (id != epic_id);

-- Task dependency constraints
ALTER TABLE task_dependencies ADD CONSTRAINT chk_task_deps_no_self_reference CHECK (task_id != depends_on_id);
ALTER TABLE task_dependencies ADD CONSTRAINT chk_task_deps_type CHECK (type IN ('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH'));

-- Time entry constraints
ALTER TABLE time_entries ADD CONSTRAINT chk_time_entries_timeline CHECK (start_time <= COALESCE(end_time, NOW()));
ALTER TABLE time_entries ADD CONSTRAINT chk_time_entries_duration CHECK (duration IS NULL OR duration >= 0);

-- File constraints
ALTER TABLE files ADD CONSTRAINT chk_files_size CHECK (size >= 0);
ALTER TABLE files ADD CONSTRAINT chk_files_virus_scan_status CHECK (virus_scan_status IN ('pending', 'clean', 'infected', 'error'));
ALTER TABLE files ADD CONSTRAINT chk_files_version CHECK (current_version >= 1);

-- Notification constraints
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_expires_after_created CHECK (expires_at IS NULL OR expires_at > created_at);

-- ============================================================================
-- REFERENTIAL INTEGRITY ENHANCEMENTS
-- ============================================================================

-- Add foreign key constraints with proper cascade behavior
ALTER TABLE workspace_members ADD CONSTRAINT fk_workspace_members_inviter 
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE project_members ADD CONSTRAINT fk_project_members_added_by 
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tasks ADD CONSTRAINT fk_tasks_reporter 
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Function to update task activity timestamp
CREATE OR REPLACE FUNCTION update_task_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = NOW();
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update task activity
DROP TRIGGER IF EXISTS trigger_update_task_activity ON tasks;
CREATE TRIGGER trigger_update_task_activity
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_activity();

-- Function to validate task status transitions
CREATE OR REPLACE FUNCTION validate_task_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow any transition for new tasks
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Define valid status transitions
  IF OLD.status = 'TODO' AND NEW.status NOT IN ('TODO', 'IN_PROGRESS', 'CANCELLED') THEN
    RAISE EXCEPTION 'Invalid status transition from TODO to %', NEW.status;
  END IF;

  IF OLD.status = 'IN_PROGRESS' AND NEW.status NOT IN ('IN_PROGRESS', 'IN_REVIEW', 'TODO', 'CANCELLED') THEN
    RAISE EXCEPTION 'Invalid status transition from IN_PROGRESS to %', NEW.status;
  END IF;

  IF OLD.status = 'IN_REVIEW' AND NEW.status NOT IN ('IN_REVIEW', 'DONE', 'IN_PROGRESS', 'CANCELLED') THEN
    RAISE EXCEPTION 'Invalid status transition from IN_REVIEW to %', NEW.status;
  END IF;

  IF OLD.status = 'DONE' AND NEW.status NOT IN ('DONE', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'Invalid status transition from DONE to %', NEW.status;
  END IF;

  IF OLD.status = 'CANCELLED' AND NEW.status NOT IN ('CANCELLED', 'TODO') THEN
    RAISE EXCEPTION 'Invalid status transition from CANCELLED to %', NEW.status;
  END IF;

  -- Set completion timestamp
  IF NEW.status = 'DONE' AND OLD.status != 'DONE' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'DONE' AND OLD.status = 'DONE' THEN
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for task status validation
DROP TRIGGER IF EXISTS trigger_validate_task_status ON tasks;
CREATE TRIGGER trigger_validate_task_status
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_task_status_transition();

-- Function to prevent circular task dependencies
CREATE OR REPLACE FUNCTION prevent_circular_dependencies()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for direct circular dependency
  IF EXISTS (
    SELECT 1 FROM task_dependencies 
    WHERE task_id = NEW.depends_on_id AND depends_on_id = NEW.task_id
  ) THEN
    RAISE EXCEPTION 'Circular dependency detected: direct cycle between tasks % and %', NEW.task_id, NEW.depends_on_id;
  END IF;

  -- Check for indirect circular dependencies using recursive CTE
  WITH RECURSIVE dependency_chain AS (
    SELECT depends_on_id as task_id, 1 as depth
    FROM task_dependencies 
    WHERE task_id = NEW.task_id
    
    UNION ALL
    
    SELECT td.depends_on_id, dc.depth + 1
    FROM task_dependencies td
    JOIN dependency_chain dc ON td.task_id = dc.task_id
    WHERE dc.depth < 10 -- Prevent infinite recursion
  )
  SELECT 1 FROM dependency_chain WHERE task_id = NEW.depends_on_id;
  
  IF FOUND THEN
    RAISE EXCEPTION 'Circular dependency detected: indirect cycle involving tasks % and %', NEW.task_id, NEW.depends_on_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for circular dependency prevention
DROP TRIGGER IF EXISTS trigger_prevent_circular_deps ON task_dependencies;
CREATE TRIGGER trigger_prevent_circular_deps
  BEFORE INSERT OR UPDATE ON task_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION prevent_circular_dependencies();

-- ============================================================================
-- STATISTICS AND MAINTENANCE
-- ============================================================================

-- Update table statistics for better query planning
ANALYZE users;
ANALYZE workspaces;
ANALYZE projects;
ANALYZE tasks;
ANALYZE workspace_members;
ANALYZE project_members;
ANALYZE team_members;
ANALYZE activities;
ANALYZE comments;
ANALYZE time_entries;
ANALYZE notifications;
ANALYZE files;

-- Create maintenance function for regular cleanup
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Clean up old sessions (older than 30 days)
  DELETE FROM sessions WHERE expires < NOW() - INTERVAL '30 days';
  
  -- Clean up old notifications (older than 90 days)
  DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days' AND is_read = true;
  
  -- Clean up old audit logs (older than 1 year)
  DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year';
  
  -- Clean up old activities (older than 6 months)
  DELETE FROM activities WHERE created_at < NOW() - INTERVAL '6 months';
  
  -- Update statistics after cleanup
  ANALYZE;
END;
$$ LANGUAGE plpgsql;

-- Comment on the cleanup function
COMMENT ON FUNCTION cleanup_old_data() IS 'Performs regular maintenance cleanup of old data to maintain performance';