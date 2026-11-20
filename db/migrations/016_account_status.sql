BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '016_account_status')
    AND (
      EXISTS (SELECT 1 FROM pg_attribute
        WHERE attrelid = 'users'::regclass
          AND attname = 'account_status' AND attnum > 0 AND NOT attisdropped)
      OR to_regclass('account_status_history') IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Account status schema already exists without migration 016; inspect it before proceeding';
  END IF;
END;
$$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'inactive', 'memorialized', 'frozen'));

CREATE TABLE IF NOT EXISTS account_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_status TEXT NOT NULL CHECK (previous_status IN ('active', 'inactive', 'memorialized', 'frozen')),
  new_status TEXT NOT NULL CHECK (new_status IN ('active', 'inactive', 'memorialized', 'frozen')),
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  changed_by_database_role TEXT NOT NULL DEFAULT CURRENT_USER,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (previous_status <> new_status)
);
CREATE INDEX IF NOT EXISTS account_status_history_user_idx
  ON account_status_history (user_id, changed_at, id);

CREATE OR REPLACE FUNCTION record_account_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO account_status_history (user_id, previous_status, new_status)
  VALUES (NEW.id, OLD.account_status, NEW.account_status);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_account_status_history ON users;
CREATE TRIGGER users_account_status_history
  AFTER UPDATE OF account_status ON users
  FOR EACH ROW
  WHEN (OLD.account_status IS DISTINCT FROM NEW.account_status)
  EXECUTE FUNCTION record_account_status_change();

INSERT INTO schema_migrations (version)
VALUES ('016_account_status')
ON CONFLICT (version) DO NOTHING;

COMMIT;
