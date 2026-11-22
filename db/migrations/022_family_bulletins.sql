BEGIN;

CREATE TABLE IF NOT EXISTS family_bulletins (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS family_bulletins_tree_created_idx
  ON family_bulletins (tree_id, created_at DESC, id);

INSERT INTO schema_migrations (version)
VALUES ('022_family_bulletins')
ON CONFLICT (version) DO NOTHING;

COMMIT;
