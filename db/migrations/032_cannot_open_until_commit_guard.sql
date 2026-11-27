BEGIN;

DROP TRIGGER IF EXISTS moments_check_time_capsule_at_commit ON moments;
CREATE CONSTRAINT TRIGGER moments_check_time_capsule_at_commit
  AFTER UPDATE ON moments DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION protect_released_time_capsule();
DROP TRIGGER IF EXISTS moment_videos_check_time_capsule_at_commit ON moment_videos;
CREATE CONSTRAINT TRIGGER moment_videos_check_time_capsule_at_commit
  AFTER INSERT OR UPDATE OR DELETE ON moment_videos DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION protect_released_time_capsule_media();
DROP TRIGGER IF EXISTS moment_audio_check_time_capsule_at_commit ON moment_audio;
CREATE CONSTRAINT TRIGGER moment_audio_check_time_capsule_at_commit
  AFTER INSERT OR UPDATE OR DELETE ON moment_audio DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION protect_released_time_capsule_media();

INSERT INTO schema_migrations (version) VALUES ('032_cannot_open_until_commit_guard')
ON CONFLICT (version) DO NOTHING;
COMMIT;
