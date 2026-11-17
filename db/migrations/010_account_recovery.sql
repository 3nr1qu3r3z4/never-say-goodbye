BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
UPDATE users SET username = 'member_' || md5(id) WHERE username IS NULL;
ALTER TABLE users
  ALTER COLUMN username SET DEFAULT ('member_' || replace(gen_random_uuid()::text, '-', ''));
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users (LOWER(username));

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_recovery_attempts (
  email_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('username', 'password')),
  requested_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (email_hash, purpose)
);

INSERT INTO schema_migrations (version)
VALUES ('010_account_recovery')
ON CONFLICT (version) DO NOTHING;

COMMIT;
