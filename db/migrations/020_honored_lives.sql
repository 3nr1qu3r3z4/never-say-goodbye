BEGIN;

CREATE TABLE IF NOT EXISTS honored_lives (
  family_placeholder_id TEXT PRIMARY KEY REFERENCES family_placeholders(id) ON DELETE CASCADE,
  passing_date DATE,
  short_story TEXT NOT NULL DEFAULT '',
  profile_photo_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version)
VALUES ('020_honored_lives')
ON CONFLICT (version) DO NOTHING;

COMMIT;
