BEGIN;

ALTER TABLE connected_lives
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS relationship_subject_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE connected_lives DROP CONSTRAINT IF EXISTS connected_lives_relationship_type_check;
ALTER TABLE connected_lives ADD CONSTRAINT connected_lives_relationship_type_check
  CHECK (relationship_type IN ('family', 'close_friend', 'mentor', 'other', 'parent', 'child', 'sibling', 'spouse_partner'));

CREATE TABLE IF NOT EXISTS connected_lives_person_tags (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connected_lives(id) ON DELETE CASCADE,
  subject_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS connected_lives_person_tags_unique_idx
  ON connected_lives_person_tags (connection_id, subject_user_id, lower(btrim(label)));

INSERT INTO schema_migrations (version)
VALUES ('015_connected_lives_directory')
ON CONFLICT (version) DO NOTHING;

COMMIT;
