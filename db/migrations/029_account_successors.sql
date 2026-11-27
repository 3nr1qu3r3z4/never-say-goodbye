BEGIN;

ALTER TABLE legacy_successors
  ALTER COLUMN legacy_tree_id DROP NOT NULL;
ALTER TABLE legacy_successors
  DROP CONSTRAINT IF EXISTS legacy_successors_legacy_tree_id_fkey;
ALTER TABLE legacy_successors
  ADD CONSTRAINT legacy_successors_legacy_tree_id_fkey
  FOREIGN KEY (legacy_tree_id) REFERENCES legacy_trees(id) ON DELETE SET NULL;

ALTER TABLE legacy_successors
  DROP CONSTRAINT IF EXISTS legacy_successors_status_check;
ALTER TABLE legacy_successors
  ADD CONSTRAINT legacy_successors_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'designated'));

CREATE UNIQUE INDEX IF NOT EXISTS legacy_successors_owner_designated_idx
  ON legacy_successors(owner_user_id) WHERE status = 'designated';

INSERT INTO schema_migrations (version)
VALUES ('029_account_successors')
ON CONFLICT (version) DO NOTHING;

COMMIT;
