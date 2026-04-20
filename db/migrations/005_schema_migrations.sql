-- Bootstrap the schema_migrations tracking table.
-- This is a no-op when the migration runner has already created it,
-- but ensures the table exists if migrations are ever run manually.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT now()
);
