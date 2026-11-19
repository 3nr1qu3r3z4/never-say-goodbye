BEGIN;

CREATE TABLE IF NOT EXISTS weekly_moment_maker_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  profile_count INTEGER NOT NULL DEFAULT 6 CHECK (profile_count BETWEEN 0 AND 100)
);

INSERT INTO weekly_moment_maker_settings (singleton, profile_count)
VALUES (TRUE, 6)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS weekly_moment_maker_weeks (
  week_start DATE PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS weekly_moment_maker_selections (
  week_start DATE NOT NULL REFERENCES weekly_moment_maker_weeks(week_start) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  PRIMARY KEY (week_start, user_id),
  UNIQUE (week_start, position)
);
CREATE INDEX IF NOT EXISTS weekly_moment_maker_selections_user_idx
  ON weekly_moment_maker_selections (user_id, week_start DESC);

CREATE OR REPLACE FUNCTION get_weekly_moment_makers()
RETURNS TABLE (
  "id" TEXT,
  "displayName" TEXT,
  "descriptorOne" TEXT,
  "descriptorTwo" TEXT,
  "descriptorThree" TEXT,
  "location" TEXT,
  "profilePhoto" TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_week DATE := date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
  configured_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(734210013);
  SELECT s.profile_count INTO STRICT configured_count
  FROM weekly_moment_maker_settings AS s
  WHERE s.singleton = TRUE;

  IF NOT EXISTS (
    SELECT 1 FROM weekly_moment_maker_weeks AS w WHERE w.week_start = current_week
  ) THEN
    INSERT INTO weekly_moment_maker_weeks (week_start) VALUES (current_week);

    INSERT INTO weekly_moment_maker_selections (week_start, user_id, position)
    SELECT current_week, candidates.id, row_number() OVER (
      ORDER BY candidates.last_featured ASC NULLS FIRST, candidates.created_at, candidates.id
    )::integer
    FROM (
      SELECT u.id, u.created_at, history.last_featured
      FROM users AS u
      LEFT JOIN (
        SELECT selection.user_id, MAX(selection.week_start) AS last_featured
        FROM weekly_moment_maker_selections AS selection
        GROUP BY selection.user_id
      ) AS history ON history.user_id = u.id
      WHERE u.featured = TRUE
        AND u.discoverability IN ('searchable', 'public')
        AND (history.last_featured IS NULL OR history.last_featured < current_week - 28)
      ORDER BY history.last_featured ASC NULLS FIRST, u.created_at, u.id
      LIMIT configured_count
    ) AS candidates;
  END IF;

  RETURN QUERY
  SELECT u.id,
         COALESCE(NULLIF(BTRIM(u.display_name), ''), 'Moment Maker'),
         COALESCE(u.descriptor_one, ''),
         COALESCE(u.descriptor_two, ''),
         COALESCE(u.descriptor_three, ''),
         CASE WHEN u.public_location THEN COALESCE(u.location, '') ELSE '' END,
         CASE WHEN u.public_profile_photo THEN NULLIF(u.profile_photo_data, '') ELSE NULL END
  FROM weekly_moment_maker_selections AS selection
  JOIN users AS u ON u.id = selection.user_id
  WHERE selection.week_start = current_week
    AND u.featured = TRUE
    AND u.discoverability IN ('searchable', 'public')
  ORDER BY selection.position;
END;
$$;

INSERT INTO schema_migrations (version)
VALUES ('013_weekly_moment_makers')
ON CONFLICT (version) DO NOTHING;

COMMIT;
