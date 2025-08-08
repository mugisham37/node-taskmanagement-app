-- Migration: Add status column to projects table
-- Created: 2025-06-29

-- Create the project_status enum type
CREATE TYPE project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled');

-- Add the status column to the projects table
ALTER TABLE projects 
ADD COLUMN status project_status NOT NULL DEFAULT 'planning';

-- Update existing projects based on their archived status
-- Set non-archived projects to 'active' and archived projects to 'completed'
UPDATE projects 
SET status = CASE 
    WHEN is_archived = true THEN 'completed'::project_status
    ELSE 'active'::project_status
END;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
CREATE INDEX IF NOT EXISTS projects_owner_status_idx ON projects(owner_id, status);

-- Add comments for documentation
COMMENT ON COLUMN projects.status IS 'Current status of the project in its lifecycle';
COMMENT ON TYPE project_status IS 'Enum defining possible project statuses';
