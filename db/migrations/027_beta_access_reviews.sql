BEGIN;

CREATE TABLE IF NOT EXISTS beta_access_reviews (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('grandfathered', 'not-grandfathered')),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version)
VALUES ('027_beta_access_reviews')
ON CONFLICT (version) DO NOTHING;

COMMIT;
