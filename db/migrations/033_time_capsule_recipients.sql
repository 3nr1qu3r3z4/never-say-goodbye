BEGIN;

ALTER TABLE cannot_open_until_settings
  ADD COLUMN IF NOT EXISTS recipient_kind TEXT,
  ADD COLUMN IF NOT EXISTS intended_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS future_recipient_id TEXT REFERENCES future_moment_makers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS placeholder_recipient_id TEXT REFERENCES family_placeholders(id) ON DELETE SET NULL;

DO $$
DECLARE constraint_name TEXT;
BEGIN
  FOR constraint_name IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'cannot_open_until_settings'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%recipient_user_id%'
      AND pg_get_constraintdef(oid) LIKE '%connection_id%'
  LOOP
    EXECUTE format('ALTER TABLE cannot_open_until_settings DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS cannot_open_until_validate_assignment ON cannot_open_until_settings;
UPDATE cannot_open_until_settings SET recipient_kind = 'current', intended_user_id = recipient_user_id
  WHERE recipient_kind IS NULL AND recipient_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS cannot_open_until_claims (
  id TEXT PRIMARY KEY,
  moment_id TEXT NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('future', 'placeholder')),
  recipient_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  claimant_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'approved', 'declined', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  requested_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS cannot_open_until_claims_moment_idx
  ON cannot_open_until_claims(moment_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS cannot_open_until_claims_active_idx
  ON cannot_open_until_claims(moment_id, recipient_kind, recipient_id)
  WHERE status IN ('open', 'pending', 'approved');

CREATE TABLE IF NOT EXISTS cannot_open_until_recipient_bindings (
  recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('future', 'placeholder')),
  recipient_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (recipient_kind, recipient_id)
);

CREATE OR REPLACE FUNCTION delete_time_capsule_recipient_binding()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM cannot_open_until_recipient_bindings
    WHERE recipient_kind = TG_ARGV[0] AND recipient_id = OLD.id;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS future_delete_time_capsule_binding ON future_moment_makers;
CREATE TRIGGER future_delete_time_capsule_binding AFTER DELETE ON future_moment_makers
  FOR EACH ROW EXECUTE FUNCTION delete_time_capsule_recipient_binding('future');
DROP TRIGGER IF EXISTS placeholder_delete_time_capsule_binding ON family_placeholders;
CREATE TRIGGER placeholder_delete_time_capsule_binding AFTER DELETE ON family_placeholders
  FOR EACH ROW EXECUTE FUNCTION delete_time_capsule_recipient_binding('placeholder');

CREATE OR REPLACE FUNCTION validate_cannot_open_until_assignment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE owner_id TEXT;
BEGIN
  SELECT user_id INTO owner_id FROM moments
    WHERE id = NEW.moment_id AND kind = 'cannot-open-until';
  IF NOT FOUND THEN RAISE EXCEPTION 'Cannot Open Until settings require a matching Moment'; END IF;
  IF NEW.recipient_kind IS NOT NULL AND NEW.recipient_kind NOT IN ('current', 'future', 'placeholder') THEN
    RAISE EXCEPTION 'Invalid intended recipient';
  END IF;
  IF (NEW.intended_user_id IS NOT NULL AND NEW.recipient_kind IS DISTINCT FROM 'current')
      OR (NEW.future_recipient_id IS NOT NULL AND NEW.recipient_kind IS DISTINCT FROM 'future')
      OR (NEW.placeholder_recipient_id IS NOT NULL AND NEW.recipient_kind IS DISTINCT FROM 'placeholder')
      OR NEW.intended_user_id = owner_id THEN
    RAISE EXCEPTION 'Invalid intended recipient';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active'
      AND (OLD.manual_released_at IS NOT NULL OR OLD.unlock_at <= clock_timestamp())
      AND ROW(NEW.recipient_kind, NEW.intended_user_id, NEW.future_recipient_id, NEW.placeholder_recipient_id)
        IS DISTINCT FROM ROW(OLD.recipient_kind, OLD.intended_user_id, OLD.future_recipient_id, OLD.placeholder_recipient_id)
      AND NOT (NEW.recipient_kind IS NOT DISTINCT FROM OLD.recipient_kind
        AND (NEW.intended_user_id IS NOT DISTINCT FROM OLD.intended_user_id OR NEW.intended_user_id IS NULL)
        AND (NEW.future_recipient_id IS NOT DISTINCT FROM OLD.future_recipient_id OR NEW.future_recipient_id IS NULL)
        AND (NEW.placeholder_recipient_id IS NOT DISTINCT FROM OLD.placeholder_recipient_id OR NEW.placeholder_recipient_id IS NULL)) THEN
    RAISE EXCEPTION 'Released Cannot Open Until recipients cannot be changed';
  END IF;
  IF (NEW.recipient_kind = 'current' AND NEW.intended_user_id IS NULL)
      OR (NEW.recipient_kind = 'future' AND NEW.future_recipient_id IS NULL)
      OR (NEW.recipient_kind = 'placeholder' AND NEW.placeholder_recipient_id IS NULL) THEN
    NEW.recipient_user_id := NULL;
    NEW.connection_id := NULL;
  END IF;
  IF NEW.recipient_user_id IS NOT NULL THEN
    IF NEW.recipient_user_id = owner_id OR (
      (NEW.recipient_kind = 'current' AND NEW.recipient_user_id = NEW.intended_user_id)
      OR (NEW.recipient_kind IN ('future', 'placeholder') AND EXISTS (
        SELECT 1 FROM cannot_open_until_claims c
        WHERE c.moment_id = NEW.moment_id AND c.recipient_kind = NEW.recipient_kind
          AND c.recipient_id = COALESCE(NEW.future_recipient_id, NEW.placeholder_recipient_id)
          AND c.claimant_user_id = NEW.recipient_user_id AND c.status = 'approved'
      ))
    ) IS NOT TRUE THEN RAISE EXCEPTION 'Recipient access requires an approved intended recipient'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cannot_open_until_validate_assignment
  BEFORE INSERT OR UPDATE ON cannot_open_until_settings
  FOR EACH ROW EXECUTE FUNCTION validate_cannot_open_until_assignment();

CREATE OR REPLACE FUNCTION check_time_capsule_recipient_at_commit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'active' AND (OLD.manual_released_at IS NOT NULL OR OLD.unlock_at <= clock_timestamp())
      AND ROW(NEW.status, NEW.release_date, NEW.release_timezone, NEW.unlock_at, NEW.manual_released_at)
        IS DISTINCT FROM ROW(OLD.status, OLD.release_date, OLD.release_timezone, OLD.unlock_at, OLD.manual_released_at) THEN
    RAISE EXCEPTION 'Released Cannot Open Until schedules are read-only';
  END IF;
  IF OLD.status = 'active' AND (OLD.manual_released_at IS NOT NULL OR OLD.unlock_at <= clock_timestamp())
      AND ROW(NEW.recipient_kind, NEW.intended_user_id, NEW.future_recipient_id, NEW.placeholder_recipient_id)
        IS DISTINCT FROM ROW(OLD.recipient_kind, OLD.intended_user_id, OLD.future_recipient_id, OLD.placeholder_recipient_id)
      AND NOT (NEW.recipient_kind IS NOT DISTINCT FROM OLD.recipient_kind
        AND (NEW.intended_user_id IS NOT DISTINCT FROM OLD.intended_user_id OR NEW.intended_user_id IS NULL)
        AND (NEW.future_recipient_id IS NOT DISTINCT FROM OLD.future_recipient_id OR NEW.future_recipient_id IS NULL)
        AND (NEW.placeholder_recipient_id IS NOT DISTINCT FROM OLD.placeholder_recipient_id OR NEW.placeholder_recipient_id IS NULL)) THEN
    RAISE EXCEPTION 'Released Cannot Open Until recipients cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cannot_open_until_recipient_at_commit ON cannot_open_until_settings;
CREATE CONSTRAINT TRIGGER cannot_open_until_recipient_at_commit
  AFTER UPDATE ON cannot_open_until_settings DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_time_capsule_recipient_at_commit();

CREATE OR REPLACE FUNCTION invalidate_cannot_open_until_assignments()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'accepted' AND (TG_OP = 'DELETE' OR NEW.status <> 'accepted'
      OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
      OR NEW.connected_user_id IS DISTINCT FROM OLD.connected_user_id) THEN
    UPDATE cannot_open_until_settings s
    SET recipient_user_id = NULL, connection_id = NULL, updated_at = clock_timestamp()
    FROM moments m WHERE m.id = s.moment_id AND (
      (m.user_id = OLD.owner_user_id AND (
        s.intended_user_id = OLD.connected_user_id OR s.recipient_user_id = OLD.connected_user_id
        OR EXISTS (SELECT 1 FROM cannot_open_until_claims c
          WHERE c.moment_id = s.moment_id AND c.claimant_user_id = OLD.connected_user_id
            AND c.status IN ('pending', 'approved') AND c.recipient_kind = s.recipient_kind
            AND c.recipient_id = COALESCE(s.future_recipient_id, s.placeholder_recipient_id))))
      OR (m.user_id = OLD.connected_user_id AND (
        s.intended_user_id = OLD.owner_user_id OR s.recipient_user_id = OLD.owner_user_id
        OR EXISTS (SELECT 1 FROM cannot_open_until_claims c
          WHERE c.moment_id = s.moment_id AND c.claimant_user_id = OLD.owner_user_id
            AND c.status IN ('pending', 'approved') AND c.recipient_kind = s.recipient_kind
            AND c.recipient_id = COALESCE(s.future_recipient_id, s.placeholder_recipient_id)))));
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION invalidate_cannot_open_until_recipient()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE cannot_open_until_settings
    SET recipient_user_id = NULL, connection_id = NULL,
      intended_user_id = CASE WHEN intended_user_id = OLD.id THEN NULL ELSE intended_user_id END,
      updated_at = clock_timestamp()
    WHERE recipient_user_id = OLD.id OR intended_user_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION activate_recipient_time_capsule(
  p_owner TEXT, p_moment TEXT, p_kind TEXT, p_recipient TEXT, p_date DATE, p_timezone TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE opening TIMESTAMPTZ;
BEGIN
  PERFORM 1 FROM moments WHERE id = p_moment AND user_id = p_owner AND kind = 'cannot-open-until' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Moment is unavailable'; END IF;
  IF p_kind = 'current' THEN
    PERFORM 1 FROM users u WHERE u.id = p_recipient AND u.id <> p_owner AND (
      u.discoverability IN ('searchable', 'public') OR EXISTS (
        SELECT 1 FROM connected_lives c WHERE c.status = 'accepted' AND
          ((c.owner_user_id = p_owner AND c.connected_user_id = u.id)
            OR (c.connected_user_id = p_owner AND c.owner_user_id = u.id))
      ) OR EXISTS (SELECT 1 FROM cannot_open_until_settings s
        WHERE s.moment_id = p_moment AND s.recipient_kind = 'current' AND s.intended_user_id = u.id));
  ELSIF p_kind = 'future' THEN
    PERFORM 1 FROM future_moment_makers f WHERE f.id = p_recipient AND f.archived_at IS NULL
      AND f.status <> 'archived' AND (f.owner_user_id = p_owner OR EXISTS (
        SELECT 1 FROM legacy_tree_members t WHERE t.tree_id = f.legacy_tree_id AND t.user_id = p_owner));
  ELSIF p_kind = 'placeholder' THEN
    PERFORM 1 FROM family_placeholders f WHERE f.id = p_recipient AND f.death_year IS NULL
      AND NOT EXISTS (SELECT 1 FROM honored_lives h WHERE h.family_placeholder_id = f.id)
      AND EXISTS (SELECT 1 FROM legacy_tree_members t WHERE t.tree_id = f.legacy_tree_id AND t.user_id = p_owner);
  ELSE
    RAISE EXCEPTION 'Recipient is unavailable';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient is unavailable'; END IF;
  SELECT MIN(t.instant) INTO opening FROM pg_timezone_names z
    CROSS JOIN LATERAL generate_series(p_date::timestamp AT TIME ZONE 'UTC' - INTERVAL '15 hours',
      p_date::timestamp AT TIME ZONE 'UTC' + INTERVAL '36 hours', INTERVAL '1 minute') t(instant)
    WHERE z.name = p_timezone AND (t.instant AT TIME ZONE z.name)::date = p_date;
  IF opening IS NULL OR opening <= clock_timestamp() THEN RAISE EXCEPTION 'Choose a valid future date and time zone'; END IF;
  INSERT INTO cannot_open_until_settings
    (moment_id, status, recipient_kind, intended_user_id, future_recipient_id, placeholder_recipient_id,
     recipient_user_id, connection_id, release_date, release_timezone, unlock_at, reviewed_at)
  VALUES (p_moment, 'active', p_kind, CASE WHEN p_kind = 'current' THEN p_recipient END,
    CASE WHEN p_kind = 'future' THEN p_recipient END, CASE WHEN p_kind = 'placeholder' THEN p_recipient END,
    CASE WHEN p_kind = 'current' THEN p_recipient END, NULL, p_date, p_timezone, opening, clock_timestamp())
  ON CONFLICT (moment_id) DO UPDATE SET status = 'active', recipient_kind = EXCLUDED.recipient_kind,
    intended_user_id = EXCLUDED.intended_user_id, future_recipient_id = EXCLUDED.future_recipient_id,
    placeholder_recipient_id = EXCLUDED.placeholder_recipient_id,
    recipient_user_id = CASE WHEN cannot_open_until_settings.status = 'active'
      AND ROW(cannot_open_until_settings.recipient_kind, cannot_open_until_settings.intended_user_id,
        cannot_open_until_settings.future_recipient_id, cannot_open_until_settings.placeholder_recipient_id)
      IS NOT DISTINCT FROM ROW(EXCLUDED.recipient_kind, EXCLUDED.intended_user_id,
        EXCLUDED.future_recipient_id, EXCLUDED.placeholder_recipient_id)
      THEN cannot_open_until_settings.recipient_user_id
      ELSE EXCLUDED.recipient_user_id END,
    connection_id = NULL, release_date = EXCLUDED.release_date, release_timezone = EXCLUDED.release_timezone,
    unlock_at = EXCLUDED.unlock_at, reviewed_at = EXCLUDED.reviewed_at, updated_at = clock_timestamp();
END;
$$;

CREATE OR REPLACE FUNCTION create_time_capsule_claim(p_owner TEXT, p_moment TEXT, p_claim TEXT, p_hash TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE s cannot_open_until_settings%ROWTYPE; target TEXT;
BEGIN
  SELECT settings.* INTO s FROM cannot_open_until_settings settings
    JOIN moments m ON m.id = settings.moment_id
    WHERE m.id = p_moment AND m.user_id = p_owner AND settings.status = 'active'
    FOR UPDATE OF settings;
  IF NOT FOUND OR s.recipient_kind NOT IN ('future', 'placeholder') OR s.recipient_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Claim is unavailable';
  END IF;
  target := COALESCE(s.future_recipient_id, s.placeholder_recipient_id);
  IF target IS NULL OR EXISTS (SELECT 1 FROM cannot_open_until_claims
      WHERE moment_id = p_moment AND recipient_kind = s.recipient_kind AND recipient_id = target
        AND status IN ('pending', 'approved')) THEN
    RAISE EXCEPTION 'Claim is unavailable';
  END IF;
  UPDATE cannot_open_until_claims SET status = 'revoked', decided_at = clock_timestamp()
    WHERE moment_id = p_moment AND status = 'open';
  INSERT INTO cannot_open_until_claims
    (id, moment_id, recipient_kind, recipient_id, token_hash, expires_at)
    VALUES (p_claim, p_moment, s.recipient_kind, target, p_hash, clock_timestamp() + INTERVAL '7 days');
END;
$$;

CREATE OR REPLACE FUNCTION decide_time_capsule_claim(p_owner TEXT, p_claim TEXT, p_approve BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE s cannot_open_until_settings%ROWTYPE; claim cannot_open_until_claims%ROWTYPE;
BEGIN
  SELECT settings.* INTO s FROM cannot_open_until_settings settings
    JOIN moments m ON m.id = settings.moment_id JOIN cannot_open_until_claims c ON c.moment_id = m.id
    WHERE c.id = p_claim AND m.user_id = p_owner AND settings.status = 'active'
    FOR UPDATE OF settings;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim is unavailable'; END IF;
  SELECT * INTO claim FROM cannot_open_until_claims WHERE id = p_claim AND status = 'pending' FOR UPDATE;
  IF NOT FOUND OR claim.claimant_user_id IS NULL OR claim.claimant_user_id = p_owner
      OR claim.recipient_kind IS DISTINCT FROM s.recipient_kind
      OR claim.recipient_id IS DISTINCT FROM COALESCE(s.future_recipient_id, s.placeholder_recipient_id)
      OR s.recipient_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Claim is unavailable';
  END IF;
  IF p_approve THEN
    IF claim.recipient_kind = 'future' THEN
      PERFORM 1 FROM future_moment_makers WHERE id = claim.recipient_id FOR UPDATE;
    ELSE
      PERFORM 1 FROM family_placeholders WHERE id = claim.recipient_id FOR UPDATE;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'Claim is unavailable'; END IF;
    INSERT INTO cannot_open_until_recipient_bindings (recipient_kind, recipient_id, user_id)
      VALUES (claim.recipient_kind, claim.recipient_id, claim.claimant_user_id)
      ON CONFLICT (recipient_kind, recipient_id) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM cannot_open_until_recipient_bindings
        WHERE recipient_kind = claim.recipient_kind AND recipient_id = claim.recipient_id
          AND user_id = claim.claimant_user_id) THEN
      RAISE EXCEPTION 'Claim does not match the confirmed recipient';
    END IF;
  END IF;
  UPDATE cannot_open_until_claims SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
    decided_at = clock_timestamp() WHERE id = p_claim;
  IF p_approve THEN
    UPDATE cannot_open_until_settings SET recipient_user_id = claim.claimant_user_id, updated_at = clock_timestamp()
      WHERE moment_id = s.moment_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION revoke_time_capsule_claim_access()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'approved' AND (NEW.status <> 'approved'
      OR NEW.claimant_user_id IS DISTINCT FROM OLD.claimant_user_id) THEN
    UPDATE cannot_open_until_settings SET recipient_user_id = NULL, connection_id = NULL,
      updated_at = clock_timestamp()
    WHERE moment_id = OLD.moment_id AND recipient_user_id = OLD.claimant_user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cannot_open_until_claim_revoke ON cannot_open_until_claims;
CREATE TRIGGER cannot_open_until_claim_revoke BEFORE UPDATE ON cannot_open_until_claims
  FOR EACH ROW EXECUTE FUNCTION revoke_time_capsule_claim_access();

INSERT INTO schema_migrations (version) VALUES ('033_time_capsule_recipients')
ON CONFLICT (version) DO NOTHING;
COMMIT;
