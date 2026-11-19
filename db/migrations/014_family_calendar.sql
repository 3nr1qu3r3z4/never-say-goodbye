BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS birth_year INTEGER CHECK (birth_year BETWEEN 1000 AND 9999),
  ADD COLUMN IF NOT EXISTS memorial_date DATE,
  ADD COLUMN IF NOT EXISTS share_birthday BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS share_anniversary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS share_memorial_date BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS share_relationship_milestones BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE family_placeholders
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS memorial_date DATE;

ALTER TABLE future_moment_makers
  ADD COLUMN IF NOT EXISTS expected_birth_date DATE;

ALTER TABLE connected_lives
  ADD COLUMN IF NOT EXISTS anniversary_date DATE;

CREATE TABLE IF NOT EXISTS family_relationship_milestones (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connected_lives(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  event_date DATE NOT NULL,
  repeats_yearly BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS family_relationship_milestones_connection_idx
  ON family_relationship_milestones (connection_id);

CREATE TABLE IF NOT EXISTS family_calendar_events (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  creator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  event_date DATE NOT NULL,
  repeats_yearly BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS family_calendar_events_tree_date_idx
  ON family_calendar_events (tree_id, event_date);

CREATE TABLE IF NOT EXISTS family_calendar_import_settings (
  tree_id TEXT PRIMARY KEY REFERENCES legacy_trees(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS family_calendar_reminders (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  day_of BOOLEAN NOT NULL DEFAULT FALSE,
  one_day_before BOOLEAN NOT NULL DEFAULT FALSE,
  one_week_before BOOLEAN NOT NULL DEFAULT FALSE,
  one_month_before BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO schema_migrations (version)
VALUES ('014_family_calendar')
ON CONFLICT (version) DO NOTHING;

COMMIT;
