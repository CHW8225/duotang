BEGIN;

CREATE SEQUENCE polysaccharide_record_sort_order_seq;

CREATE TABLE polysaccharide_records (
  id TEXT PRIMARY KEY,
  upload_id TEXT NOT NULL DEFAULT '',
  standard_name TEXT NOT NULL DEFAULT '',
  english_name TEXT NOT NULL DEFAULT '',
  aliases TEXT NOT NULL DEFAULT '',
  ref_id TEXT NOT NULL DEFAULT '',
  literature_title TEXT NOT NULL DEFAULT '',
  journal TEXT NOT NULL DEFAULT '',
  publication_year INTEGER,
  doi TEXT NOT NULL DEFAULT '',
  pmid TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_species TEXT NOT NULL DEFAULT '',
  source_category TEXT NOT NULL DEFAULT '',
  extraction_part TEXT NOT NULL DEFAULT '',
  extraction_method TEXT NOT NULL DEFAULT '',
  purification_method TEXT NOT NULL DEFAULT '',
  molecular_weight_value TEXT NOT NULL DEFAULT '',
  molecular_weight_unit TEXT NOT NULL DEFAULT '',
  molecular_weight_method TEXT NOT NULL DEFAULT '',
  monosaccharide_original TEXT NOT NULL DEFAULT '',
  monosaccharide_standardized TEXT NOT NULL DEFAULT '',
  monosaccharide_ratio TEXT NOT NULL DEFAULT '',
  glycosidic_linkage TEXT NOT NULL DEFAULT '',
  backbone_description TEXT NOT NULL DEFAULT '',
  branch_description TEXT NOT NULL DEFAULT '',
  branch_site TEXT NOT NULL DEFAULT '',
  substituent_modification TEXT NOT NULL DEFAULT '',
  structure_completeness TEXT NOT NULL DEFAULT '',
  activity_category TEXT NOT NULL DEFAULT '',
  activity_subcategory TEXT NOT NULL DEFAULT '',
  evidence_level TEXT NOT NULL DEFAULT '',
  experiment_type TEXT NOT NULL DEFAULT '',
  experiment_model TEXT NOT NULL DEFAULT '',
  experiment_object TEXT NOT NULL DEFAULT '',
  endpoint TEXT NOT NULL DEFAULT '',
  conclusion TEXT NOT NULL DEFAULT '',
  mechanism_pathway TEXT NOT NULL DEFAULT '',
  key_molecules TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT '',
  recorder TEXT NOT NULL DEFAULT '',
  entry_date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  data_quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  sort_order BIGINT NOT NULL DEFAULT nextval('polysaccharide_record_sort_order_seq'),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  deletion_reason TEXT,
  CONSTRAINT records_deletion_metadata_complete CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL AND deletion_reason IS NULL)
    OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL AND deletion_reason IS NOT NULL)
  )
);
ALTER SEQUENCE polysaccharide_record_sort_order_seq
  OWNED BY polysaccharide_records.sort_order;

CREATE INDEX idx_records_active_sort
  ON polysaccharide_records (sort_order DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_records_standard_name ON polysaccharide_records (standard_name);
CREATE INDEX idx_records_updated_at ON polysaccharide_records (updated_at DESC);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));

CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);

CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  authenticated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions (expires_at);

CREATE TABLE email_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_email_tokens_user_purpose ON email_tokens (user_id, purpose);

CREATE TABLE favorites (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  record_id TEXT NOT NULL REFERENCES polysaccharide_records (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, record_id)
);

CREATE TABLE saved_searches (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query_params JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, name)
);

CREATE TABLE record_attachments (
  id UUID PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES polysaccharide_records (id) ON DELETE RESTRICT,
  object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  description TEXT NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  rights_confirmed_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT
);
CREATE INDEX idx_record_attachments_record_id ON record_attachments (record_id);

CREATE TABLE import_jobs (
  id UUID PRIMARY KEY,
  filename TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('previewing', 'invalid', 'ready', 'imported', 'failed')),
  total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows INTEGER NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE TABLE import_job_rows (
  id UUID PRIMARY KEY,
  import_job_id UUID NOT NULL REFERENCES import_jobs (id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL CHECK (row_number > 0),
  record_id TEXT,
  row_data JSONB NOT NULL,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (import_job_id, row_number)
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'system')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changed_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at DESC);

COMMIT;
