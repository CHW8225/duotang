ALTER TABLE record_attachments ADD COLUMN IF NOT EXISTS slot_number SMALLINT;
ALTER TABLE record_attachments ADD COLUMN IF NOT EXISTS upload_status TEXT NOT NULL DEFAULT 'ready';
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY record_id ORDER BY created_at,id) AS slot
  FROM record_attachments
)
UPDATE record_attachments a SET slot_number=ranked.slot FROM ranked WHERE ranked.id=a.id AND a.slot_number IS NULL;
ALTER TABLE record_attachments ADD CONSTRAINT record_attachments_slot_range CHECK (slot_number BETWEEN 1 AND 10);
ALTER TABLE record_attachments ADD CONSTRAINT record_attachments_status CHECK (upload_status IN ('pending','ready'));
ALTER TABLE record_attachments ALTER COLUMN slot_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS attachment_slots ON record_attachments(record_id,slot_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_public_attachments ON record_attachments(record_id,is_public) WHERE deleted_at IS NULL AND upload_status='ready';

CREATE TABLE cos_cleanup_jobs (
  id UUID PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('pending','processing','completed','failed')) DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_until TIMESTAMPTZ,
  alert_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_cos_cleanup_due ON cos_cleanup_jobs(status,next_attempt_at) WHERE status='pending';
