-- Add building_info JSONB column to projects table
-- Stores building metadata from address lookup (type, year, area, heating, etc.)
-- Used to provide context-aware AI chat responses

ALTER TABLE projects ADD COLUMN IF NOT EXISTS building_info JSONB;

-- Add share_token for future sharing feature
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token) WHERE share_token IS NOT NULL;
