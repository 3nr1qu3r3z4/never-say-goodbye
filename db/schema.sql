CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT ('member_' || replace(gen_random_uuid()::text, '-', '')),
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  display_style TEXT NOT NULL CHECK (display_style IN ('full-name', 'first-last', 'custom')),
  membership TEXT NOT NULL CHECK (membership IN ('free', 'tier-2', 'tier-3')),
  site_theme TEXT NOT NULL DEFAULT 'classic',
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'memorialized', 'frozen')),
  discoverability TEXT NOT NULL DEFAULT 'searchable' CHECK (discoverability IN ('private', 'searchable', 'public')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  public_profile_photo BOOLEAN NOT NULL DEFAULT TRUE,
  public_profile_bio BOOLEAN NOT NULL DEFAULT TRUE,
  public_birthplace BOOLEAN NOT NULL DEFAULT FALSE,
  public_location BOOLEAN NOT NULL DEFAULT TRUE,
  public_shared_moments BOOLEAN NOT NULL DEFAULT TRUE,
  public_connected_lives BOOLEAN NOT NULL DEFAULT TRUE,
  public_legacy_tree BOOLEAN NOT NULL DEFAULT TRUE,
  public_future_moment_makers BOOLEAN NOT NULL DEFAULT FALSE,
  public_personal_moments BOOLEAN NOT NULL DEFAULT FALSE,
  private_moment_access_requests BOOLEAN NOT NULL DEFAULT TRUE,
  tree_participation TEXT NOT NULL DEFAULT 'owner',
  family_contributions BOOLEAN NOT NULL DEFAULT TRUE,
  connected_life_contributions BOOLEAN NOT NULL DEFAULT TRUE,
  require_moment_approval BOOLEAN NOT NULL DEFAULT TRUE,
  profile_photo_data TEXT,
  bio TEXT NOT NULL DEFAULT '',
  descriptor_one TEXT NOT NULL DEFAULT '',
  descriptor_two TEXT NOT NULL DEFAULT '',
  descriptor_three TEXT NOT NULL DEFAULT '',
  birthplace TEXT,
  location TEXT,
  personal_motto TEXT,
  birth_date DATE,
  birth_year INTEGER CHECK (birth_year BETWEEN 1000 AND 9999),
  memorial_date DATE,
  share_birthday BOOLEAN NOT NULL DEFAULT FALSE,
  share_anniversary BOOLEAN NOT NULL DEFAULT FALSE,
  share_memorial_date BOOLEAN NOT NULL DEFAULT FALSE,
  share_relationship_milestones BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users (LOWER(username));

CREATE TABLE IF NOT EXISTS beta_access_reviews (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('grandfathered', 'not-grandfathered')),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_analytics_visitors (
  visitor_id TEXT PRIMARY KEY,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  signup_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS site_analytics_visitors_last_seen_idx
  ON site_analytics_visitors (last_seen_at);

CREATE TABLE IF NOT EXISTS site_analytics_visitor_days (
  visitor_id TEXT NOT NULL REFERENCES site_analytics_visitors(visitor_id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  PRIMARY KEY (visitor_id, visit_date)
);
CREATE INDEX IF NOT EXISTS site_analytics_visitor_days_date_idx
  ON site_analytics_visitor_days (visit_date);

CREATE TABLE IF NOT EXISTS site_analytics_daily (
  visit_date DATE PRIMARY KEY,
  visits BIGINT NOT NULL DEFAULT 0 CHECK (visits >= 0)
);

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

CREATE TABLE IF NOT EXISTS profile_visits (
  viewer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
  PRIMARY KEY (viewer_user_id, profile_user_id, visit_date),
  CHECK (viewer_user_id <> profile_user_id)
);
CREATE INDEX IF NOT EXISTS profile_visits_date_idx ON profile_visits (visit_date);

CREATE TABLE IF NOT EXISTS account_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_status TEXT NOT NULL CHECK (previous_status IN ('active', 'inactive', 'memorialized', 'frozen')),
  new_status TEXT NOT NULL CHECK (new_status IN ('active', 'inactive', 'memorialized', 'frozen')),
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  changed_by_database_role TEXT NOT NULL DEFAULT CURRENT_USER,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (previous_status <> new_status)
);
CREATE INDEX IF NOT EXISTS account_status_history_user_idx
  ON account_status_history (user_id, changed_at, id);

CREATE OR REPLACE FUNCTION record_account_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO account_status_history (user_id, previous_status, new_status)
  VALUES (NEW.id, OLD.account_status, NEW.account_status);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_account_status_history ON users;
CREATE TRIGGER users_account_status_history
  AFTER UPDATE OF account_status ON users
  FOR EACH ROW
  WHEN (OLD.account_status IS DISTINCT FROM NEW.account_status)
  EXECUTE FUNCTION record_account_status_change();

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

CREATE TABLE IF NOT EXISTS legacy_frame_interests (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS legacy_frame_interests_email_unique_idx
  ON legacy_frame_interests (LOWER(email));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_recovery_attempts (
  email_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('username', 'password')),
  requested_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (email_hash, purpose)
);

CREATE TABLE IF NOT EXISTS legacy_trees (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS legacy_tree_members (
  tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'contributor', 'member')),
  relationship TEXT NOT NULL DEFAULT 'Family Member',
  line_partner_type TEXT,
  line_partner_id TEXT,
  allow_milestone_admin BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TEXT NOT NULL,
  CHECK ((line_partner_type IS NULL AND line_partner_id IS NULL) OR
         (line_partner_type IS NOT NULL AND line_partner_type IN ('member', 'placeholder', 'future') AND line_partner_id IS NOT NULL)),
  PRIMARY KEY (tree_id, user_id)
);
CREATE INDEX IF NOT EXISTS legacy_tree_members_user_idx ON legacy_tree_members(user_id);

CREATE TABLE IF NOT EXISTS family_placeholders (
  id TEXT PRIMARY KEY,
  legacy_tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  line_partner_type TEXT,
  line_partner_id TEXT,
  birth_year INTEGER,
  death_year INTEGER,
  birth_date DATE,
  memorial_date DATE,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((line_partner_type IS NULL AND line_partner_id IS NULL) OR
         (line_partner_type IS NOT NULL AND line_partner_type IN ('member', 'placeholder', 'future') AND line_partner_id IS NOT NULL)),
  CHECK (birth_year IS NULL OR birth_year BETWEEN 1000 AND 9999),
  CHECK (death_year IS NULL OR death_year BETWEEN 1000 AND 9999),
  CHECK (
    birth_year IS NULL OR death_year IS NULL OR death_year >= birth_year
  )
);
CREATE INDEX IF NOT EXISTS family_placeholders_tree_idx
  ON family_placeholders(legacy_tree_id, created_at);

CREATE TABLE IF NOT EXISTS honored_lives (
  family_placeholder_id TEXT PRIMARY KEY REFERENCES family_placeholders(id) ON DELETE CASCADE,
  passing_date DATE,
  short_story TEXT NOT NULL DEFAULT '',
  profile_photo_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS legacy_successors (
  id TEXT PRIMARY KEY,
  legacy_tree_id TEXT REFERENCES legacy_trees(id) ON DELETE SET NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  successor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  successor_name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'successor',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'designated')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (owner_user_id != successor_user_id)
);
CREATE INDEX IF NOT EXISTS legacy_successors_tree_idx ON legacy_successors(legacy_tree_id);
CREATE INDEX IF NOT EXISTS legacy_successors_user_idx ON legacy_successors(successor_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS legacy_successors_owner_designated_idx
  ON legacy_successors(owner_user_id) WHERE status = 'designated';

CREATE TABLE IF NOT EXISTS connected_lives (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connected_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  relationship_type TEXT CHECK (
    relationship_type IN ('family', 'close_friend', 'mentor', 'other', 'parent', 'child', 'sibling', 'spouse_partner')
  ),
  accepted_at TIMESTAMPTZ,
  relationship_subject_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  anniversary_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (owner_user_id != connected_user_id)
);
CREATE INDEX IF NOT EXISTS connected_lives_owner_idx ON connected_lives(owner_user_id, status);
CREATE INDEX IF NOT EXISTS connected_lives_connected_idx ON connected_lives(connected_user_id, status);

CREATE TABLE IF NOT EXISTS connected_lives_person_tags (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connected_lives(id) ON DELETE CASCADE,
  subject_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS connected_lives_person_tags_unique_idx
  ON connected_lives_person_tags (connection_id, subject_user_id, lower(btrim(label)));

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

CREATE TABLE IF NOT EXISTS future_moment_makers (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legacy_tree_id TEXT REFERENCES legacy_trees(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  line_partner_type TEXT,
  line_partner_id TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting-claim' CHECK (status IN ('awaiting-claim', 'claimed', 'archived')),
  archived_at TIMESTAMPTZ,
  expected_birth_date DATE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((line_partner_type IS NULL AND line_partner_id IS NULL) OR
         (line_partner_type IS NOT NULL AND line_partner_type IN ('member', 'placeholder', 'future') AND line_partner_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS future_moment_makers_owner_idx ON future_moment_makers(owner_user_id, status);

CREATE TABLE IF NOT EXISTS family_relationship_milestones (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connected_lives(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  event_date DATE NOT NULL,
  repeats_yearly BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS family_relationship_milestones_connection_idx
  ON family_relationship_milestones (connection_id);

CREATE TABLE IF NOT EXISTS family_tree_milestones (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  placeholder_id TEXT REFERENCES family_placeholders(id) ON DELETE CASCADE,
  future_id TEXT REFERENCES future_moment_makers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('birthday', 'anniversary', 'wedding', 'graduation', 'custom')),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  year INTEGER CHECK (year BETWEEN 1000 AND 9999),
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  day INTEGER CHECK (day BETWEEN 1 AND 31),
  repeats_yearly BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (num_nonnulls(user_id, placeholder_id, future_id) = 1),
  CHECK (day IS NULL OR month IS NOT NULL),
  CHECK (day IS NULL OR day <= CASE
    WHEN month = 2 THEN CASE WHEN year IS NULL OR (year % 4 = 0 AND (year % 100 <> 0 OR year % 400 = 0)) THEN 29 ELSE 28 END
    WHEN month IN (4, 6, 9, 11) THEN 30 ELSE 31 END),
  CHECK (NOT repeats_yearly OR (month IS NOT NULL AND day IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS family_tree_milestones_tree_idx ON family_tree_milestones (tree_id);
CREATE UNIQUE INDEX IF NOT EXISTS family_tree_milestones_user_birthday_idx
  ON family_tree_milestones (tree_id, user_id) WHERE kind = 'birthday' AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS family_tree_milestones_placeholder_birthday_idx
  ON family_tree_milestones (tree_id, placeholder_id) WHERE kind = 'birthday' AND placeholder_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS family_tree_milestones_future_birthday_idx
  ON family_tree_milestones (tree_id, future_id) WHERE kind = 'birthday' AND future_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS family_calendar_events (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  creator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  event_date DATE NOT NULL,
  repeats_yearly BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS family_calendar_events_tree_date_idx
  ON family_calendar_events (tree_id, event_date);

CREATE TABLE IF NOT EXISTS family_bulletins (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS family_bulletins_tree_created_idx
  ON family_bulletins (tree_id, created_at DESC, id);

CREATE TABLE IF NOT EXISTS family_calendar_import_settings (
  tree_id TEXT PRIMARY KEY REFERENCES legacy_trees(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS family_calendar_reminders (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  day_of BOOLEAN NOT NULL DEFAULT FALSE,
  one_day_before BOOLEAN NOT NULL DEFAULT FALSE,
  one_week_before BOOLEAN NOT NULL DEFAULT FALSE,
  one_month_before BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS moments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  future_moment_maker_id TEXT REFERENCES future_moment_makers(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('shared', 'personal', 'cannot-open-until', 'future-moment-maker')),
  title TEXT NOT NULL,
  story TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '[]',
  details_json TEXT NOT NULL DEFAULT '{}',
  audience TEXT NOT NULL DEFAULT 'connections' CHECK (audience IN ('public', 'connections', 'family', 'private')),
  access_code_hash TEXT,
  release_date TEXT,
  occasion TEXT,
  family_placeholder_id TEXT REFERENCES family_placeholders(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS moments_user_kind_idx ON moments(user_id, kind, created_at);

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

CREATE TABLE IF NOT EXISTS moment_videos (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  moment_id TEXT UNIQUE REFERENCES moments(id) ON DELETE SET NULL,
  pathname TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 104857600),
  state TEXT NOT NULL CHECK (state IN ('pending', 'ready', 'attached', 'deleting')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS moment_videos_cleanup_idx
  ON moment_videos (state, last_used_at);
CREATE TABLE IF NOT EXISTS moment_audio (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  moment_id TEXT UNIQUE REFERENCES moments(id) ON DELETE SET NULL,
  pathname TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 104857600),
  state TEXT NOT NULL CHECK (state IN ('pending', 'ready', 'attached', 'deleting')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS moment_audio_cleanup_idx
  ON moment_audio (state, last_used_at);

CREATE OR REPLACE FUNCTION protect_released_time_capsule_media()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_id TEXT;
  released BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' AND
      ROW(NEW.moment_id, NEW.state, NEW.pathname, NEW.filename, NEW.content_type, NEW.size_bytes)
      IS NOT DISTINCT FROM
      ROW(OLD.moment_id, OLD.state, OLD.pathname, OLD.filename, OLD.content_type, OLD.size_bytes) THEN
    RETURN NEW;
  END IF;
  FOR target_id IN
    SELECT DISTINCT id FROM (
      SELECT CASE WHEN TG_OP <> 'INSERT' THEN OLD.moment_id END AS id
      UNION ALL
      SELECT CASE WHEN TG_OP <> 'DELETE' THEN NEW.moment_id END AS id
    ) ids WHERE id IS NOT NULL ORDER BY id
  LOOP
    SELECT (s.status = 'active' AND (s.manual_released_at IS NOT NULL OR s.unlock_at <= clock_timestamp()))
      INTO released
      FROM cannot_open_until_settings s
      JOIN moments m ON m.id = s.moment_id AND m.kind = 'cannot-open-until'
      WHERE s.moment_id = target_id FOR UPDATE OF s;
    IF COALESCE(released, FALSE) THEN
      RAISE EXCEPTION 'Released Cannot Open Until media is read-only';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS moment_videos_protect_time_capsule ON moment_videos;
CREATE TRIGGER moment_videos_protect_time_capsule
  BEFORE INSERT OR UPDATE OR DELETE ON moment_videos
  FOR EACH ROW EXECUTE FUNCTION protect_released_time_capsule_media();
DROP TRIGGER IF EXISTS moment_audio_protect_time_capsule ON moment_audio;
CREATE TRIGGER moment_audio_protect_time_capsule
  BEFORE INSERT OR UPDATE OR DELETE ON moment_audio
  FOR EACH ROW EXECUTE FUNCTION protect_released_time_capsule_media();

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

CREATE OR REPLACE FUNCTION save_cannot_open_until_content(
  p_owner TEXT, p_id TEXT, p_version TEXT, p_title TEXT, p_story TEXT, p_tags TEXT,
  p_message TEXT, p_photo_action TEXT, p_photo_data TEXT, p_photo_name TEXT,
  p_video_action TEXT, p_video_id TEXT, p_audio_action TEXT, p_audio_id TEXT
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  item moments%ROWTYPE;
  settings cannot_open_until_settings%ROWTYPE;
  details JSONB;
  content JSONB;
  video_name TEXT;
  audio_name TEXT;
BEGIN
  SELECT * INTO item FROM moments
    WHERE id = p_id AND user_id = p_owner AND kind = 'cannot-open-until' FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  SELECT * INTO settings FROM cannot_open_until_settings WHERE moment_id = p_id FOR UPDATE;
  IF FOUND AND settings.status = 'active'
      AND (settings.manual_released_at IS NOT NULL OR settings.unlock_at <= clock_timestamp()) THEN
    RETURN 'released';
  END IF;
  IF item.updated_at <> p_version THEN RETURN 'conflict'; END IF;
  IF p_photo_action NOT IN ('keep', 'replace', 'remove')
      OR p_video_action NOT IN ('keep', 'replace', 'remove')
      OR p_audio_action NOT IN ('keep', 'replace', 'remove') THEN
    RETURN 'invalid';
  END IF;
  IF p_video_action = 'replace' THEN
    SELECT filename INTO video_name FROM moment_videos
      WHERE id = p_video_id AND user_id = p_owner AND state = 'ready' AND moment_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN RETURN 'video_unavailable'; END IF;
  END IF;
  IF p_audio_action = 'replace' THEN
    SELECT filename INTO audio_name FROM moment_audio
      WHERE id = p_audio_id AND user_id = p_owner AND state = 'ready' AND moment_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN RETURN 'audio_unavailable'; END IF;
  END IF;
  details := item.details_json::jsonb;
  details := jsonb_set(details, '{writtenMessage}', to_jsonb(p_message), TRUE);
  IF jsonb_typeof(details->'attachmentNames') IS DISTINCT FROM 'object' THEN
    details := jsonb_set(details, '{attachmentNames}', '{}'::jsonb, TRUE);
  END IF;
  content := item.content_json::jsonb - 'written';
  IF p_message <> '' THEN content := content || '"written"'::jsonb; END IF;
  IF p_photo_action <> 'keep' THEN
    details := jsonb_set(details, '{photoData}', to_jsonb(CASE WHEN p_photo_action = 'replace' THEN p_photo_data ELSE '' END), TRUE);
    details := details #- '{attachmentNames,photo}';
    content := content - 'photo';
    IF p_photo_action = 'replace' THEN
      details := jsonb_set(details, '{attachmentNames,photo}', to_jsonb(p_photo_name), TRUE);
      content := content || '"photo"'::jsonb;
    END IF;
  END IF;
  IF p_video_action <> 'keep' THEN
    UPDATE moment_videos SET moment_id = NULL, state = 'deleting'
      WHERE moment_id = p_id AND state = 'attached';
    details := details #- '{attachmentNames,video}';
    content := content - 'video';
    IF p_video_action = 'replace' THEN
      UPDATE moment_videos SET moment_id = p_id, state = 'attached', last_used_at = clock_timestamp()
        WHERE id = p_video_id;
      details := jsonb_set(details, '{attachmentNames,video}', to_jsonb(video_name), TRUE);
      content := content || '"video"'::jsonb;
    END IF;
  END IF;
  IF p_audio_action <> 'keep' THEN
    UPDATE moment_audio SET moment_id = NULL, state = 'deleting'
      WHERE moment_id = p_id AND state = 'attached';
    details := details #- '{attachmentNames,voice}';
    content := content - 'voice';
    IF p_audio_action = 'replace' THEN
      UPDATE moment_audio SET moment_id = p_id, state = 'attached', last_used_at = clock_timestamp()
        WHERE id = p_audio_id;
      details := jsonb_set(details, '{attachmentNames,voice}', to_jsonb(audio_name), TRUE);
      content := content || '"voice"'::jsonb;
    END IF;
  END IF;
  UPDATE moments SET title = p_title, story = p_story, tags = p_tags,
    details_json = details::text, content_json = content::text,
    updated_at = to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    WHERE id = p_id;
  RETURN 'saved';
END;
$$;
CREATE INDEX IF NOT EXISTS moments_family_placeholder_idx
  ON moments(family_placeholder_id);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('shared', 'personal', 'cannot-open-until', 'future-moment-maker')),
  title TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL,
  access_code_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS drafts_user_kind_idx ON drafts(user_id, kind, updated_at DESC);

INSERT INTO schema_migrations (version)
VALUES ('001_initial_schema')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('002_profile_photo')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('003_profile_details')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('004_profile_words')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('005_profile_fields')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('006_legacy_control_visibility')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('007_family_placeholders')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('008_lives_notifications')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('009_connected_lives_relationship_type')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('010_account_recovery')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('011_profile_birthplace')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('012_profile_location_visibility')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('013_weekly_moment_makers')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('014_family_calendar')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('015_connected_lives_directory')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('016_account_status')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('017_profile_visits')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('018_email_preferences'), ('019_site_analytics'), ('020_honored_lives')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('021_moment_videos'), ('022_family_bulletins'), ('023_tree_milestones')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('026_moment_audio')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('027_beta_access_reviews')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('030_cannot_open_until')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('031_cannot_open_until_media')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('032_cannot_open_until_commit_guard')
ON CONFLICT (version) DO NOTHING;

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
