BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_membership_check;
ALTER TABLE users ADD CONSTRAINT users_membership_check
  CHECK (membership IN ('free', 'tier-2', 'tier-3', 'legacy-plus', 'family-legacy', 'legacy-forever'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();

CREATE TABLE IF NOT EXISTS lifetime_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_owner_user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS successor_assignments (
  owner_user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  successor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  inactivity_days INTEGER NOT NULL CHECK (inactivity_days IN (30, 60, 90)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (owner_user_id <> successor_user_id)
);

CREATE TABLE IF NOT EXISTS successor_transfers (
  membership_id UUID PRIMARY KEY REFERENCES lifetime_memberships(id),
  original_owner_user_id TEXT NOT NULL UNIQUE,
  successor_user_id TEXT NOT NULL,
  successor_previous_membership TEXT NOT NULL,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (original_owner_user_id <> successor_user_id)
);

CREATE OR REPLACE FUNCTION successor_can_manage(p_owner TEXT)
RETURNS BOOLEAN LANGUAGE SQL VOLATILE AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN lifetime_memberships m ON m.current_owner_user_id = u.id
    WHERE u.id = p_owner AND u.membership = 'legacy-forever'
      AND NOT EXISTS (SELECT 1 FROM successor_transfers t WHERE t.membership_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM successor_transfers t WHERE t.original_owner_user_id = u.id)
  )
$$;

CREATE OR REPLACE FUNCTION successor_can_select(p_owner TEXT, p_successor TEXT)
RETURNS BOOLEAN LANGUAGE SQL VOLATILE AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = p_successor AND u.id <> p_owner AND u.membership <> 'legacy-forever'
      AND (
        u.discoverability IN ('searchable', 'public')
        OR EXISTS (
          SELECT 1 FROM connected_lives c WHERE c.status = 'accepted'
            AND ((c.owner_user_id = p_owner AND c.connected_user_id = u.id)
              OR (c.connected_user_id = p_owner AND c.owner_user_id = u.id))
        )
        OR EXISTS (
          SELECT 1 FROM successor_assignments a
          WHERE a.owner_user_id = p_owner AND a.successor_user_id = u.id
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION successor_save_assignment(p_owner TEXT, p_successor TEXT, p_days INTEGER)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  IF p_days NOT IN (30, 60, 90) OR p_days IS NULL THEN
    RETURN 'invalid_trigger';
  END IF;
  PERFORM id FROM users WHERE id IN (p_owner, p_successor) ORDER BY id FOR UPDATE;
  IF NOT successor_can_manage(p_owner) THEN RETURN 'ineligible'; END IF;
  IF NOT successor_can_select(p_owner, p_successor) THEN RETURN 'invalid_successor'; END IF;
  INSERT INTO successor_assignments (owner_user_id, successor_user_id, inactivity_days)
  VALUES (p_owner, p_successor, p_days)
  ON CONFLICT (owner_user_id) DO UPDATE SET
    successor_user_id = EXCLUDED.successor_user_id,
    inactivity_days = EXCLUDED.inactivity_days,
    updated_at = clock_timestamp();
  RETURN 'saved';
END
$$;

CREATE OR REPLACE FUNCTION successor_transfer(p_owner TEXT, p_successor TEXT, p_due_only BOOLEAN)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_membership UUID;
  v_previous TEXT;
  v_assignment successor_assignments%ROWTYPE;
  v_activity TIMESTAMPTZ;
BEGIN
  PERFORM id FROM users WHERE id IN (p_owner, p_successor) ORDER BY id FOR UPDATE;
  IF NOT successor_can_manage(p_owner) THEN RETURN 'ineligible'; END IF;
  IF p_due_only THEN
    SELECT * INTO v_assignment FROM successor_assignments WHERE owner_user_id = p_owner FOR UPDATE;
    IF NOT FOUND OR v_assignment.successor_user_id IS DISTINCT FROM p_successor THEN RETURN 'not_due'; END IF;
    SELECT last_activity_at INTO v_activity FROM users WHERE id = p_owner;
    IF v_activity + make_interval(days => v_assignment.inactivity_days) > clock_timestamp() THEN
      RETURN 'not_due';
    END IF;
  ELSIF NOT successor_can_select(p_owner, p_successor) THEN
    RETURN 'invalid_successor';
  END IF;
  SELECT membership INTO v_previous FROM users WHERE id = p_successor AND id <> p_owner;
  IF NOT FOUND OR v_previous = 'legacy-forever' THEN RETURN 'invalid_successor'; END IF;
  SELECT id INTO v_membership FROM lifetime_memberships
    WHERE current_owner_user_id = p_owner FOR UPDATE;
  IF NOT FOUND THEN RETURN 'ineligible'; END IF;
  UPDATE users SET membership = 'free' WHERE id = p_owner;
  UPDATE users SET membership = 'legacy-forever' WHERE id = p_successor;
  UPDATE lifetime_memberships SET current_owner_user_id = p_successor WHERE id = v_membership;
  INSERT INTO successor_transfers (membership_id, original_owner_user_id, successor_user_id, successor_previous_membership)
  VALUES (v_membership, p_owner, p_successor, v_previous);
  DELETE FROM successor_assignments WHERE owner_user_id IN (p_owner, p_successor);
  RETURN 'transferred';
END
$$;

INSERT INTO schema_migrations (version) VALUES ('035_successor_membership_transfer')
ON CONFLICT (version) DO NOTHING;

COMMIT;
