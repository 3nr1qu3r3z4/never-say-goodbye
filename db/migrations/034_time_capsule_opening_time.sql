BEGIN;

CREATE OR REPLACE FUNCTION activate_recipient_time_capsule(
  p_owner TEXT, p_moment TEXT, p_kind TEXT, p_recipient TEXT,
  p_date DATE, p_timezone TEXT, p_time TIME, p_delay_minutes INTEGER
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  opening TIMESTAMPTZ;
  previous cannot_open_until_settings%ROWTYPE;
  matches INTEGER;
  local_opening TIMESTAMP;
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
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
    RAISE EXCEPTION 'Choose a valid time zone';
  END IF;
  SELECT * INTO previous FROM cannot_open_until_settings WHERE moment_id = p_moment FOR UPDATE;
  IF p_delay_minutes IS NOT NULL THEN
    IF p_date IS NOT NULL OR p_time IS NOT NULL OR p_delay_minutes < 1 OR p_delay_minutes > 525600
        OR previous.status = 'active' THEN
      RAISE EXCEPTION 'Choose a valid delay of at most 365 days';
    END IF;
    opening := clock_timestamp() + p_delay_minutes * INTERVAL '1 minute';
  ELSE
    IF p_date IS NULL OR p_time IS NULL OR EXTRACT(SECOND FROM p_time) <> 0 THEN
      RAISE EXCEPTION 'Choose a valid future date and time';
    END IF;
    local_opening := p_date + p_time;
    IF previous.status = 'active' AND previous.release_timezone = p_timezone
        AND previous.release_date = p_date
        AND date_trunc('minute', previous.unlock_at AT TIME ZONE p_timezone) = local_opening THEN
      opening := previous.unlock_at;
    ELSE
      SELECT COUNT(*), MIN(t.instant) INTO matches, opening
      FROM generate_series(local_opening AT TIME ZONE 'UTC' - INTERVAL '16 hours',
        local_opening AT TIME ZONE 'UTC' + INTERVAL '16 hours', INTERVAL '1 minute') t(instant)
      WHERE t.instant AT TIME ZONE p_timezone = local_opening;
      IF matches <> 1 THEN
        RAISE EXCEPTION 'Choose a date and time that exists exactly once in the selected time zone';
      END IF;
    END IF;
  END IF;
  IF opening <= clock_timestamp() THEN RAISE EXCEPTION 'Choose a valid future date and time'; END IF;
  INSERT INTO cannot_open_until_settings
    (moment_id, status, recipient_kind, intended_user_id, future_recipient_id, placeholder_recipient_id,
     recipient_user_id, connection_id, release_date, release_timezone, unlock_at, reviewed_at)
  VALUES (p_moment, 'active', p_kind, CASE WHEN p_kind = 'current' THEN p_recipient END,
    CASE WHEN p_kind = 'future' THEN p_recipient END, CASE WHEN p_kind = 'placeholder' THEN p_recipient END,
    CASE WHEN p_kind = 'current' THEN p_recipient END, NULL, (opening AT TIME ZONE p_timezone)::date,
    p_timezone, opening, clock_timestamp())
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

INSERT INTO schema_migrations (version) VALUES ('034_time_capsule_opening_time')
ON CONFLICT (version) DO NOTHING;
COMMIT;
