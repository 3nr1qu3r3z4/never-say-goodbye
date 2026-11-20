BEGIN;

CREATE TABLE IF NOT EXISTS email_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  new_connection_requests BOOLEAN NOT NULL DEFAULT TRUE,
  connection_request_accepted BOOLEAN NOT NULL DEFAULT TRUE,
  new_photo_shared BOOLEAN NOT NULL DEFAULT TRUE,
  new_video_shared BOOLEAN NOT NULL DEFAULT TRUE,
  new_audio_message_shared BOOLEAN NOT NULL DEFAULT TRUE,
  shared_moments BOOLEAN NOT NULL DEFAULT TRUE,
  legacy_successor_updates BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO schema_migrations (version)
VALUES ('018_email_preferences')
ON CONFLICT (version) DO NOTHING;

COMMIT;
