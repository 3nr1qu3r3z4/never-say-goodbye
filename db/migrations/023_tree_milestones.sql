BEGIN;

ALTER TABLE legacy_tree_members
  ADD COLUMN IF NOT EXISTS allow_milestone_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS family_tree_milestones (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  placeholder_id TEXT REFERENCES family_placeholders(id) ON DELETE CASCADE,
  future_id TEXT REFERENCES future_moment_makers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('birthday', 'anniversary', 'wedding', 'graduation', 'custom')),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  year INTEGER CHECK (year BETWEEN 1000 AND 9999),
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  day INTEGER CHECK (day BETWEEN 1 AND 31),
  repeats_yearly BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (num_nonnulls(user_id, placeholder_id, future_id) = 1),
  CHECK (day IS NULL OR month IS NOT NULL),
  CHECK (day IS NULL OR day <= CASE
    WHEN month = 2 THEN CASE WHEN year IS NULL OR (year % 4 = 0 AND (year % 100 <> 0 OR year % 400 = 0)) THEN 29 ELSE 28 END
    WHEN month IN (4, 6, 9, 11) THEN 30 ELSE 31 END),
  CHECK (NOT repeats_yearly OR (month IS NOT NULL AND day IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS family_tree_milestones_tree_idx ON family_tree_milestones (tree_id);
CREATE UNIQUE INDEX IF NOT EXISTS family_tree_milestones_user_birthday_idx
  ON family_tree_milestones (tree_id, user_id) WHERE kind = 'birthday' AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS family_tree_milestones_placeholder_birthday_idx
  ON family_tree_milestones (tree_id, placeholder_id) WHERE kind = 'birthday' AND placeholder_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS family_tree_milestones_future_birthday_idx
  ON family_tree_milestones (tree_id, future_id) WHERE kind = 'birthday' AND future_id IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('023_tree_milestones')
ON CONFLICT (version) DO NOTHING;

COMMIT;
