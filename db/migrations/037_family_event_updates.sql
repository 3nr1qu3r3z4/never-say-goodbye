BEGIN;

CREATE TABLE IF NOT EXISTS family_event_updates (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL CHECK (char_length(event_id) BETWEEN 1 AND 512),
  occurrence_date DATE NOT NULL,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS family_event_updates_event_idx
  ON family_event_updates (tree_id, event_id, occurrence_date, created_at, id);
CREATE INDEX IF NOT EXISTS family_event_updates_tree_created_idx
  ON family_event_updates (tree_id, created_at DESC, id);

INSERT INTO schema_migrations (version) VALUES ('037_family_event_updates')
ON CONFLICT (version) DO NOTHING;

COMMIT;
