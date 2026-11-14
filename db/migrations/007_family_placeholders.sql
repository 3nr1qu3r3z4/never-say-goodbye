BEGIN;

ALTER TABLE legacy_tree_members
  ADD COLUMN IF NOT EXISTS relationship TEXT NOT NULL DEFAULT 'Family Member';

CREATE TABLE IF NOT EXISTS family_placeholders (
  id TEXT PRIMARY KEY,
  legacy_tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  birth_year INTEGER,
  death_year INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (birth_year IS NULL OR birth_year BETWEEN 1000 AND 9999),
  CHECK (death_year IS NULL OR death_year BETWEEN 1000 AND 9999),
  CHECK (
    birth_year IS NULL OR death_year IS NULL OR death_year >= birth_year
  )
);
CREATE INDEX IF NOT EXISTS family_placeholders_tree_idx
  ON family_placeholders(legacy_tree_id, created_at);

ALTER TABLE moments
  ADD COLUMN IF NOT EXISTS family_placeholder_id TEXT
  REFERENCES family_placeholders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS moments_family_placeholder_idx
  ON moments(family_placeholder_id);

INSERT INTO schema_migrations (version)
VALUES ('007_family_placeholders')
ON CONFLICT (version) DO NOTHING;

COMMIT;
