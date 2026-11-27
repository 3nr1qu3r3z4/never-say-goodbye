BEGIN;

CREATE TABLE IF NOT EXISTS cannot_open_until_settings (
  moment_id TEXT PRIMARY KEY REFERENCES moments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'review_required' CHECK (status IN ('review_required', 'active')),
  recipient_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  connection_id TEXT REFERENCES connected_lives(id) ON DELETE SET NULL,
  release_date DATE,
  release_timezone TEXT,
  unlock_at TIMESTAMPTZ,
  manual_released_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((recipient_user_id IS NULL) = (connection_id IS NULL)),
  CHECK (status <> 'active' OR
    (release_date IS NOT NULL AND release_timezone IS NOT NULL AND unlock_at IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS cannot_open_until_recipient_idx
  ON cannot_open_until_settings(recipient_user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS cannot_open_until_connection_idx
  ON cannot_open_until_settings(connection_id) WHERE connection_id IS NOT NULL;

CREATE OR REPLACE FUNCTION validate_cannot_open_until_assignment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM moments WHERE id = NEW.moment_id AND kind = 'cannot-open-until') THEN
    RAISE EXCEPTION 'Cannot Open Until settings require a matching Moment';
  END IF;
  IF NEW.recipient_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM connected_lives c JOIN moments m ON m.id = NEW.moment_id
    WHERE c.id = NEW.connection_id AND c.status = 'accepted'
      AND m.user_id <> NEW.recipient_user_id
      AND ((c.owner_user_id = m.user_id AND c.connected_user_id = NEW.recipient_user_id)
        OR (c.connected_user_id = m.user_id AND c.owner_user_id = NEW.recipient_user_id))
    FOR UPDATE OF c
  ) THEN
    RAISE EXCEPTION 'Recipient must be an accepted Connected Lives member';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cannot_open_until_validate_assignment ON cannot_open_until_settings;
CREATE TRIGGER cannot_open_until_validate_assignment
  BEFORE INSERT OR UPDATE OF moment_id, recipient_user_id, connection_id ON cannot_open_until_settings
  FOR EACH ROW EXECUTE FUNCTION validate_cannot_open_until_assignment();

CREATE OR REPLACE FUNCTION protect_released_time_capsule()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  released BOOLEAN;
BEGIN
  IF OLD.kind <> 'cannot-open-until' THEN RETURN NEW; END IF;
  SELECT (status = 'active' AND (manual_released_at IS NOT NULL OR unlock_at <= clock_timestamp()))
    INTO released FROM cannot_open_until_settings WHERE moment_id = OLD.id FOR UPDATE;
  IF COALESCE(released, FALSE) AND
      ROW(NEW.kind, NEW.title, NEW.story, NEW.tags, NEW.content_json, NEW.details_json,
          NEW.audience, NEW.access_code_hash, NEW.release_date, NEW.occasion)
      IS DISTINCT FROM
      ROW(OLD.kind, OLD.title, OLD.story, OLD.tags, OLD.content_json, OLD.details_json,
          OLD.audience, OLD.access_code_hash, OLD.release_date, OLD.occasion) THEN
    RAISE EXCEPTION 'Released Cannot Open Until Moments are read-only';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS moments_protect_released_time_capsule ON moments;
CREATE TRIGGER moments_protect_released_time_capsule BEFORE UPDATE ON moments
  FOR EACH ROW EXECUTE FUNCTION protect_released_time_capsule();

CREATE OR REPLACE FUNCTION protect_released_time_capsule_schedule()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'active' AND (OLD.manual_released_at IS NOT NULL OR OLD.unlock_at <= clock_timestamp())
      AND ROW(NEW.status, NEW.release_date, NEW.release_timezone, NEW.unlock_at, NEW.manual_released_at)
          IS DISTINCT FROM ROW(OLD.status, OLD.release_date, OLD.release_timezone, OLD.unlock_at, OLD.manual_released_at) THEN
    RAISE EXCEPTION 'Released Cannot Open Until schedules are read-only';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cannot_open_until_protect_released_schedule ON cannot_open_until_settings;
CREATE TRIGGER cannot_open_until_protect_released_schedule BEFORE UPDATE ON cannot_open_until_settings
  FOR EACH ROW EXECUTE FUNCTION protect_released_time_capsule_schedule();

CREATE OR REPLACE FUNCTION invalidate_cannot_open_until_assignments()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'accepted' AND (TG_OP = 'DELETE' OR NEW.status <> 'accepted'
      OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
      OR NEW.connected_user_id IS DISTINCT FROM OLD.connected_user_id) THEN
    UPDATE cannot_open_until_settings
    SET recipient_user_id = NULL, connection_id = NULL, updated_at = clock_timestamp()
    WHERE connection_id = OLD.id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS connected_lives_invalidate_cannot_open_until ON connected_lives;
CREATE TRIGGER connected_lives_invalidate_cannot_open_until
  BEFORE UPDATE OF status, owner_user_id, connected_user_id OR DELETE ON connected_lives
  FOR EACH ROW EXECUTE FUNCTION invalidate_cannot_open_until_assignments();

CREATE OR REPLACE FUNCTION invalidate_cannot_open_until_recipient()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE cannot_open_until_settings
  SET recipient_user_id = NULL, connection_id = NULL, updated_at = clock_timestamp()
  WHERE recipient_user_id = OLD.id;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS users_invalidate_cannot_open_until ON users;
CREATE TRIGGER users_invalidate_cannot_open_until
  BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION invalidate_cannot_open_until_recipient();

INSERT INTO schema_migrations (version) VALUES ('030_cannot_open_until')
ON CONFLICT (version) DO NOTHING;
COMMIT;
