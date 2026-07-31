BEGIN;

ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS error_rows INTEGER NOT NULL DEFAULT 0 CHECK (error_rows >= 0);
ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS conflict_rows INTEGER NOT NULL DEFAULT 0 CHECK (conflict_rows >= 0);
ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS warning_rows INTEGER NOT NULL DEFAULT 0 CHECK (warning_rows >= 0);
ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS imported_rows INTEGER NOT NULL DEFAULT 0 CHECK (imported_rows >= 0);
ALTER TABLE import_job_rows ADD COLUMN IF NOT EXISTS conflicts JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs (created_at DESC);

COMMIT;
