-- Add search index table
CREATE TABLE search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    search_vector TEXT,
    tags TEXT[] DEFAULT '{}',
    permissions TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    UNIQUE(entity_type, entity_id),
    INDEX idx_search_index_workspace (workspace_id),
    INDEX idx_search_index_entity_type (entity_type),
    INDEX idx_search_index_tags (tags),
    INDEX idx_search_index_permissions (permissions),
    INDEX idx_search_index_title (title),
    INDEX idx_search_index_content (content),
    INDEX idx_search_index_updated (updated_at DESC)
);

-- Add full-text search index for PostgreSQL
CREATE INDEX idx_search_index_fulltext ON search_index 
USING gin(to_tsvector('english', title || ' ' || content));

-- Add saved searches table
CREATE TABLE saved_search (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    query TEXT NOT NULL,
    filters JSONB DEFAULT '{}',
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with UUID[] DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    sort_by VARCHAR(50) DEFAULT 'relevance',
    sort_order VARCHAR(4) DEFAULT 'desc' CHECK (sort_order IN ('asc', 'desc')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_saved_search_user (user_id),
    INDEX idx_saved_search_workspace (workspace_id),
    INDEX idx_saved_search_shared (is_shared),
    INDEX idx_saved_search_default (user_id, workspace_id, is_default),
    INDEX idx_saved_search_name (name),
    INDEX idx_saved_search_updated (updated_at DESC),
    
    -- Constraints
    UNIQUE(user_id, workspace_id, name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Add saved search usage tracking table
CREATE TABLE saved_search_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saved_search_id UUID NOT NULL,
    user_id UUID NOT NULL,
    used_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_saved_search_usage_search (saved_search_id),
    INDEX idx_saved_search_usage_user (user_id),
    INDEX idx_saved_search_usage_date (used_at DESC),
    
    -- Constraints
    FOREIGN KEY (saved_search_id) REFERENCES saved_search(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add search analytics table
CREATE TABLE search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    user_id UUID,
    query TEXT NOT NULL,
    entity_types TEXT[] DEFAULT '{}',
    filters JSONB DEFAULT '{}',
    result_count INTEGER DEFAULT 0,
    response_time INTEGER DEFAULT 0, -- in milliseconds
    executed_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_search_analytics_workspace (workspace_id),
    INDEX idx_search_analytics_user (user_id),
    INDEX idx_search_analytics_date (executed_at DESC),
    INDEX idx_search_analytics_query (query),
    INDEX idx_search_analytics_entity_types (entity_types),
    
    -- Constraints
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Add search presets table for system and custom presets
CREATE TABLE search_preset (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    filters JSONB NOT NULL DEFAULT '{}',
    sort_by VARCHAR(50) DEFAULT 'relevance',
    sort_order VARCHAR(4) DEFAULT 'desc' CHECK (sort_order IN ('asc', 'desc')),
    entity_types TEXT[] DEFAULT '{}',
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_search_preset_workspace (workspace_id),
    INDEX idx_search_preset_system (is_system),
    INDEX idx_search_preset_active (is_active),
    INDEX idx_search_preset_name (name),
    
    -- Constraints
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, name) -- Allow same name across workspaces
);

-- Add search history table for user search patterns
CREATE TABLE search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    query TEXT NOT NULL,
    filters JSONB DEFAULT '{}',
    entity_types TEXT[] DEFAULT '{}',
    result_count INTEGER DEFAULT 0,
    executed_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_search_history_user (user_id),
    INDEX idx_search_history_workspace (workspace_id),
    INDEX idx_search_history_date (executed_at DESC),
    INDEX idx_search_history_query (query),
    
    -- Constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Add function to update search_vector automatically
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector = to_tsvector('english', NEW.title || ' ' || NEW.content);
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically update search vector
CREATE TRIGGER trigger_update_search_vector
    BEFORE INSERT OR UPDATE OF title, content ON search_index
    FOR EACH ROW
    EXECUTE FUNCTION update_search_vector();

-- Add function to clean up old search analytics (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_search_analytics()
RETURNS void AS $$
BEGIN
    DELETE FROM search_analytics 
    WHERE executed_at < NOW() - INTERVAL '90 days';
    
    DELETE FROM search_history 
    WHERE executed_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Add function to get search suggestions
CREATE OR REPLACE FUNCTION get_search_suggestions(
    partial_query TEXT,
    workspace_uuid UUID,
    suggestion_limit INTEGER DEFAULT 10
)
RETURNS TABLE(suggestion TEXT, frequency INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        word,
        COUNT(*)::INTEGER as freq
    FROM (
        SELECT unnest(string_to_array(lower(title), ' ')) as word
        FROM search_index 
        WHERE workspace_id = workspace_uuid
        AND lower(title) LIKE '%' || lower(partial_query) || '%'
        
        UNION ALL
        
        SELECT unnest(tags) as word
        FROM search_index 
        WHERE workspace_id = workspace_uuid
        AND EXISTS (
            SELECT 1 FROM unnest(tags) as tag 
            WHERE lower(tag) LIKE '%' || lower(partial_query) || '%'
        )
    ) words
    WHERE length(word) > 2
    AND word LIKE '%' || lower(partial_query) || '%'
    GROUP BY word
    ORDER BY freq DESC, word
    LIMIT suggestion_limit;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for better search performance
CREATE INDEX CONCURRENTLY idx_search_index_composite 
ON search_index(workspace_id, entity_type, updated_at DESC);

CREATE INDEX CONCURRENTLY idx_search_index_metadata_gin 
ON search_index USING gin(metadata);

-- Add partial indexes for common queries
CREATE INDEX CONCURRENTLY idx_search_index_active_tasks 
ON search_index(workspace_id, updated_at DESC) 
WHERE entity_type = 'task' AND (metadata->>'status') NOT IN ('completed', 'cancelled');

CREATE INDEX CONCURRENTLY idx_search_index_recent 
ON search_index(workspace_id, entity_type, updated_at DESC) 
WHERE updated_at > NOW() - INTERVAL '30 days';

-- Insert system search presets
INSERT INTO search_preset (id, name, description, filters, sort_by, sort_order, entity_types, is_system) VALUES
(
    gen_random_uuid(),
    'My Tasks',
    'Tasks assigned to me that are not completed',
    '{"criteria": [{"field": "assignee", "operator": "eq", "value": "{{currentUserId}}"}, {"field": "status", "operator": "nin", "value": ["completed", "cancelled"]}], "logicalOperator": "AND"}',
    'dueDate',
    'asc',
    ARRAY['task'],
    true
),
(
    gen_random_uuid(),
    'Overdue Tasks',
    'Tasks that are past their due date',
    '{"criteria": [{"field": "dueDate", "operator": "lt", "value": "{{today}}"}, {"field": "status", "operator": "nin", "value": ["completed", "cancelled"]}], "logicalOperator": "AND"}',
    'dueDate',
    'asc',
    ARRAY['task'],
    true
),
(
    gen_random_uuid(),
    'High Priority',
    'High and urgent priority items',
    '{"criteria": [{"field": "priority", "operator": "in", "value": ["high", "urgent"]}], "logicalOperator": "AND"}',
    'priority',
    'desc',
    ARRAY['task', 'project'],
    true
),
(
    gen_random_uuid(),
    'Recent Activity',
    'Recently updated items',
    '{"criteria": [{"field": "updatedAt", "operator": "gte", "value": "{{last7Days}}"}], "logicalOperator": "AND"}',
    'updatedAt',
    'desc',
    ARRAY['task', 'project', 'comment'],
    true
),
(
    gen_random_uuid(),
    'My Projects',
    'Projects where I am the owner or member',
    '{"criteria": [{"field": "owner", "operator": "eq", "value": "{{currentUserId}}"}], "logicalOperator": "OR"}',
    'updatedAt',
    'desc',
    ARRAY['project'],
    true
);

-- Add comments to tables
COMMENT ON TABLE search_index IS 'Full-text search index for all searchable entities';
COMMENT ON TABLE saved_search IS 'User-defined saved searches with filters and preferences';
COMMENT ON TABLE saved_search_usage IS 'Tracking usage of saved searches for analytics';
COMMENT ON TABLE search_analytics IS 'Analytics data for search queries and performance';
COMMENT ON TABLE search_preset IS 'System and custom search presets with predefined filters';
COMMENT ON TABLE search_history IS 'User search history for pattern analysis and suggestions';

-- Add column comments
COMMENT ON COLUMN search_index.search_vector IS 'PostgreSQL tsvector for full-text search';
COMMENT ON COLUMN search_index.metadata IS 'Entity-specific metadata for filtering';
COMMENT ON COLUMN search_index.permissions IS 'Array of permission strings for access control';
COMMENT ON COLUMN saved_search.shared_with IS 'Array of user IDs who have access to this saved search';
COMMENT ON COLUMN search_analytics.response_time IS 'Search execution time in milliseconds';
COMMENT ON COLUMN search_preset.is_system IS 'Whether this is a system-defined preset';