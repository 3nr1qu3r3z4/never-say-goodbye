BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS birthplace TEXT;

INSERT INTO schema_migrations (version)
VALUES ('011_profile_birthplace')
ON CONFLICT (version) DO NOTHING;

COMMIT;
