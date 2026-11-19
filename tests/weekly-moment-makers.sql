-- Run only against an empty, disposable database with the current schema installed.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM weekly_moment_maker_weeks) THEN
    RAISE EXCEPTION 'Weekly rotation tests require an empty disposable database';
  END IF;
END;
$$;

INSERT INTO users (
  id, email, password_hash, first_name, last_name, display_name, display_style, membership,
  discoverability, featured, descriptor_one, descriptor_two, descriptor_three,
  location, profile_photo_data, public_location, public_profile_photo, created_at, updated_at
)
VALUES
  ('new-a', 'a@example.test', 'test', 'A', 'Test', 'New A', 'first-last', 'free', 'public', TRUE, 'One', 'Two', 'Three', 'Hidden', 'photo-a', FALSE, FALSE, '2020-01-01', '2020-01-01'),
  ('new-b', 'b@example.test', 'test', 'B', 'Test', 'New B', 'first-last', 'free', 'searchable', TRUE, '', '', '', 'Visible', 'photo-b', TRUE, TRUE, '2020-01-02', '2020-01-02'),
  ('old', 'c@example.test', 'test', 'C', 'Test', 'Old', 'first-last', 'free', 'public', TRUE, '', '', '', '', NULL, TRUE, TRUE, '2020-01-03', '2020-01-03'),
  ('recent', 'd@example.test', 'test', 'D', 'Test', 'Recent', 'first-last', 'free', 'public', TRUE, '', '', '', '', NULL, TRUE, TRUE, '2020-01-04', '2020-01-04'),
  ('private', 'e@example.test', 'test', 'E', 'Test', 'Private', 'first-last', 'free', 'private', TRUE, '', '', '', '', NULL, TRUE, TRUE, '2020-01-05', '2020-01-05'),
  ('opted-out', 'f@example.test', 'test', 'F', 'Test', 'Opted Out', 'first-last', 'free', 'public', FALSE, '', '', '', '', NULL, TRUE, TRUE, '2020-01-06', '2020-01-06');

UPDATE weekly_moment_maker_settings SET profile_count = 3 WHERE singleton = TRUE;
INSERT INTO weekly_moment_maker_weeks (week_start)
SELECT date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - days
FROM (VALUES (28), (35)) AS offsets(days);
INSERT INTO weekly_moment_maker_selections (week_start, user_id, position)
SELECT date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 28, 'recent', 1
UNION ALL
SELECT date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 35, 'old', 1;

DO $$
DECLARE
  selected TEXT[];
  hidden_location TEXT;
  hidden_photo TEXT;
  visible_profile RECORD;
BEGIN
  SELECT array_agg(p.id) INTO selected FROM get_weekly_moment_makers() AS p;
  IF selected IS DISTINCT FROM ARRAY['new-a', 'new-b', 'old'] THEN
    RAISE EXCEPTION 'Unexpected selection: %', selected;
  END IF;

  SELECT p.location, p."profilePhoto" INTO hidden_location, hidden_photo
  FROM get_weekly_moment_makers() AS p WHERE p.id = 'new-a';
  IF hidden_location <> '' OR hidden_photo IS NOT NULL THEN
    RAISE EXCEPTION 'Private profile fields were exposed';
  END IF;

  SELECT * INTO visible_profile FROM get_weekly_moment_makers() AS p WHERE p.id = 'new-b';
  IF visible_profile.location <> 'Visible' OR visible_profile."profilePhoto" <> 'photo-b' THEN
    RAISE EXCEPTION 'Visible profile fields were not returned';
  END IF;

  UPDATE weekly_moment_maker_settings SET profile_count = 1 WHERE singleton = TRUE;
  UPDATE users SET featured = FALSE WHERE id = 'new-b';
  UPDATE users SET discoverability = 'private' WHERE id = 'old';
  SELECT array_agg(p.id) INTO selected FROM get_weekly_moment_makers() AS p;
  IF selected IS DISTINCT FROM ARRAY['new-a'] THEN
    RAISE EXCEPTION 'Opt-out or private profile remained visible: %', selected;
  END IF;
  IF (SELECT count(*) FROM weekly_moment_maker_selections
      WHERE week_start = date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) <> 3 THEN
    RAISE EXCEPTION 'The existing weekly selection was unexpectedly replaced';
  END IF;
END;
$$;

DELETE FROM weekly_moment_maker_weeks
WHERE week_start = date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
UPDATE users SET featured = FALSE WHERE id = 'new-a';

DO $$
DECLARE
  selected TEXT[];
BEGIN
  IF EXISTS (SELECT 1 FROM get_weekly_moment_makers()) THEN
    RAISE EXCEPTION 'Recently featured or ineligible users filled empty slots';
  END IF;
  UPDATE users SET featured = TRUE WHERE id = 'new-a';
  IF EXISTS (SELECT 1 FROM get_weekly_moment_makers()) THEN
    RAISE EXCEPTION 'An empty weekly selection changed midweek';
  END IF;

  DELETE FROM weekly_moment_maker_weeks
  WHERE week_start = date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
  SELECT array_agg(p.id) INTO selected FROM get_weekly_moment_makers() AS p;
  IF selected IS DISTINCT FROM ARRAY['new-a'] THEN
    RAISE EXCEPTION 'Configured count or available selection was incorrect: %', selected;
  END IF;
END;
$$;

ROLLBACK;
