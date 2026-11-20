BEGIN;

CREATE TABLE IF NOT EXISTS profile_visits (
  viewer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
  PRIMARY KEY (viewer_user_id, profile_user_id, visit_date),
  CHECK (viewer_user_id <> profile_user_id)
);
CREATE INDEX IF NOT EXISTS profile_visits_date_idx ON profile_visits (visit_date);

INSERT INTO schema_migrations (version)
VALUES ('017_profile_visits')
ON CONFLICT (version) DO NOTHING;

COMMIT;
