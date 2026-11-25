BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS site_theme TEXT NOT NULL DEFAULT 'classic';

INSERT INTO schema_migrations (version) VALUES ('024_site_theme')
ON CONFLICT (version) DO NOTHING;

COMMIT;
