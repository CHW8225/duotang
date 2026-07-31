BEGIN;

CREATE INDEX IF NOT EXISTS idx_records_deleted_at
  ON polysaccharide_records (deleted_at, sort_order DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action, created_at DESC);

COMMIT;
