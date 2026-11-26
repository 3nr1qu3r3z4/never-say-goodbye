BEGIN;

CREATE TABLE IF NOT EXISTS moment_audio (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  moment_id TEXT UNIQUE REFERENCES moments(id) ON DELETE SET NULL,
  pathname TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 104857600),
  state TEXT NOT NULL CHECK (state IN ('pending', 'ready', 'attached', 'deleting')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS moment_audio_cleanup_idx
  ON moment_audio (state, last_used_at);

INSERT INTO schema_migrations (version)
VALUES ('026_moment_audio')
ON CONFLICT (version) DO NOTHING;

COMMIT;
