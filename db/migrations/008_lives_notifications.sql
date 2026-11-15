BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (
    type IN (
      'connected_lives_request',
      'connected_lives_accepted',
      'connected_lives_declined',
      'legacy_tree_request',
      'private_moment_access_request',
      'future_moment_maker_invitation',
      'family_placeholder_request'
    )
  ),
  related_entity_type TEXT NOT NULL,
  related_entity_id TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (recipient_user_id, type, related_entity_type, related_entity_id)
);

CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx
  ON notifications(recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;

INSERT INTO schema_migrations (version)
VALUES ('008_lives_notifications')
ON CONFLICT (version) DO NOTHING;

COMMIT;
