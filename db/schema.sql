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
  joined_at TEXT NOT NULL,
  PRIMARY KEY (tree_id, user_id)
);
CREATE INDEX IF NOT EXISTS legacy_tree_members_user_idx ON legacy_tree_members(user_id);

CREATE TABLE IF NOT EXISTS family_placeholders (
  id TEXT PRIMARY KEY,
  legacy_tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  birth_year INTEGER,
  death_year INTEGER,
  birth_date DATE,
  memorial_date DATE,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (birth_year IS NULL OR birth_year BETWEEN 1000 AND 9999),
  CHECK (death_year IS NULL OR death_year BETWEEN 1000 AND 9999),
  CHECK (
    birth_year IS NULL OR death_year IS NULL OR death_year >= birth_year
  )
);
CREATE INDEX IF NOT EXISTS family_placeholders_tree_idx
  ON family_placeholders(legacy_tree_id, created_at);

CREATE TABLE IF NOT EXISTS legacy_successors (
  id TEXT PRIMARY KEY,
  legacy_tree_id TEXT NOT NULL REFERENCES legacy_trees(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  successor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  successor_name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'successor',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (owner_user_id != successor_user_id)
);
CREATE INDEX IF NOT EXISTS legacy_successors_tree_idx ON legacy_successors(legacy_tree_id);
CREATE INDEX IF NOT EXISTS legacy_successors_user_idx ON legacy_successors(successor_user_id);

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
  status TEXT NOT NULL DEFAULT 'awaiting-claim' CHECK (status IN ('awaiting-claim', 'claimed', 'archived')),
  expected_birth_date DATE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS moments_user_kind_idx ON moments(user_id, kind, created_at);
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
