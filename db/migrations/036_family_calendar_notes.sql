BEGIN;

CREATE TABLE IF NOT EXISTS family_calendar_notes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL CHECK (char_length(event_id) BETWEEN 1 AND 512),
  occurrence_date DATE NOT NULL,
  note TEXT NOT NULL CHECK (char_length(btrim(note)) BETWEEN 1 AND 1000),
  PRIMARY KEY (user_id, tree_id, event_id, occurrence_date)
);

INSERT INTO schema_migrations (version)
VALUES ('036_family_calendar_notes')
ON CONFLICT (version) DO NOTHING;

COMMIT;
