BEGIN;

ALTER TABLE connected_lives
  ADD COLUMN IF NOT EXISTS relationship_type TEXT
  CHECK (relationship_type IN ('family', 'close_friend', 'mentor', 'other'));

INSERT INTO schema_migrations (version)
VALUES ('009_connected_lives_relationship_type')
ON CONFLICT (version) DO NOTHING;

COMMIT;
