CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  display_style TEXT NOT NULL CHECK (display_style IN ('full-name', 'first-last', 'custom')),
  membership TEXT NOT NULL CHECK (membership IN ('free', 'tier-2', 'tier-3')),
  discoverability TEXT NOT NULL DEFAULT 'searchable' CHECK (discoverability IN ('private', 'searchable', 'public')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  profile_photo_data TEXT,
  bio TEXT NOT NULL DEFAULT '',
  location TEXT,
  personal_motto TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (LOWER(email));

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
  joined_at TEXT NOT NULL,
  PRIMARY KEY (tree_id, user_id)
);
CREATE INDEX IF NOT EXISTS legacy_tree_members_user_idx ON legacy_tree_members(user_id);

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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (owner_user_id != connected_user_id)
);
CREATE INDEX IF NOT EXISTS connected_lives_owner_idx ON connected_lives(owner_user_id, status);
CREATE INDEX IF NOT EXISTS connected_lives_connected_idx ON connected_lives(connected_user_id, status);

CREATE TABLE IF NOT EXISTS future_moment_makers (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legacy_tree_id TEXT REFERENCES legacy_trees(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting-claim' CHECK (status IN ('awaiting-claim', 'claimed', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS future_moment_makers_owner_idx ON future_moment_makers(owner_user_id, status);

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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS moments_user_kind_idx ON moments(user_id, kind, created_at);

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
