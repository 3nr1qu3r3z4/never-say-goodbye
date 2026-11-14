BEGIN;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_photo_data TEXT;

INSERT INTO schema_migrations (version)
VALUES ('002_profile_photo')
ON CONFLICT (version) DO NOTHING;

COMMIT;
