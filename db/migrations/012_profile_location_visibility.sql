BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_birthplace BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_location BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO schema_migrations (version)
VALUES ('012_profile_location_visibility')
ON CONFLICT (version) DO NOTHING;

COMMIT;
