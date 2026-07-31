BEGIN;

ALTER TABLE user_sessions RENAME COLUMN id TO token_hash;

CREATE TABLE auth_rate_limits (
  key TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_auth_rate_limits_reset_at ON auth_rate_limits (reset_at);

COMMIT;
