# Never Say Goodbye

Never Say Goodbye is a Moment Maker platform for preserving stories, moments,
and family connections.

## Run locally and deploy

The application uses Neon managed PostgreSQL for persistent data. It does not
create a local data directory or write account data to the app filesystem.

1. Create a PostgreSQL database with Neon and copy its pooled connection string.
2. Set `DATABASE_URL` in the shell where you will run the migration, or use the
   Neon SQL Editor directly:
   - In PowerShell, set `$env:DATABASE_URL` to the Neon connection string, then
     run the migrations in order:
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/001_initial_schema.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/002_profile_photo.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/003_profile_details.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/004_profile_words.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/005_profile_fields.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/006_legacy_control_visibility.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/007_family_placeholders.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/008_lives_notifications.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/009_connected_lives_relationship_type.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/010_account_recovery.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/011_profile_birthplace.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/012_profile_location_visibility.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/013_weekly_moment_makers.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/014_family_calendar.sql`.
   - In Bash, export `DATABASE_URL` and run
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_initial_schema.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_profile_photo.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/003_profile_details.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/004_profile_words.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/005_profile_fields.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/006_legacy_control_visibility.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/007_family_placeholders.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/008_lives_notifications.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/009_connected_lives_relationship_type.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/010_account_recovery.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/011_profile_birthplace.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/012_profile_location_visibility.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/013_weekly_moment_makers.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/014_family_calendar.sql`.
   - In the Neon Console, open the SQL Editor for the intended database. Run
     [`db/migrations/001_initial_schema.sql`](./db/migrations/001_initial_schema.sql)
     first, then run
     [`db/migrations/002_profile_photo.sql`](./db/migrations/002_profile_photo.sql)
     then [`db/migrations/003_profile_details.sql`](./db/migrations/003_profile_details.sql)
     then [`db/migrations/004_profile_words.sql`](./db/migrations/004_profile_words.sql)
     then [`db/migrations/005_profile_fields.sql`](./db/migrations/005_profile_fields.sql)
     then [`db/migrations/006_legacy_control_visibility.sql`](./db/migrations/006_legacy_control_visibility.sql)
     then [`db/migrations/007_family_placeholders.sql`](./db/migrations/007_family_placeholders.sql)
     then [`db/migrations/008_lives_notifications.sql`](./db/migrations/008_lives_notifications.sql)
     then [`db/migrations/009_connected_lives_relationship_type.sql`](./db/migrations/009_connected_lives_relationship_type.sql)
     then [`db/migrations/010_account_recovery.sql`](./db/migrations/010_account_recovery.sql)
     then [`db/migrations/011_profile_birthplace.sql`](./db/migrations/011_profile_birthplace.sql)
     then [`db/migrations/012_profile_location_visibility.sql`](./db/migrations/012_profile_location_visibility.sql)
     then [`db/migrations/013_weekly_moment_makers.sql`](./db/migrations/013_weekly_moment_makers.sql)
     then [`db/migrations/014_family_calendar.sql`](./db/migrations/014_family_calendar.sql)
     in order.
3. Set `DATABASE_URL` to the same pooled connection string in local
   `.env.local` and in Vercel Project Settings → Environment Variables for each
   deployment environment. Confirm Vercel points to the same Neon project and
   database where you ran the migration.
4. Redeploy after setting or changing Vercel environment variables.

All fourteen migrations are idempotent and record their application in
`schema_migrations`. [`db/schema.sql`](./db/schema.sql) is the standalone
bootstrap copy of the current schema; use all fourteen versioned migrations above for
an existing database. There is no automatic migration runner in the
application, so SQL must be applied to Neon before database-backed features
can use new schema changes. The initial migration creates
`users`, `sessions`, `legacy_trees`, `legacy_tree_members`, `connected_lives`,
`future_moment_makers`, `moments`, `drafts`, `legacy_successors`, and
`legacy_frame_interests`; subsequent migrations add profile photo, bio,
location, personal motto, and three profile descriptor fields.

Verify the selected database and required tables in Neon SQL Editor:

```sql
SELECT current_database(), current_schema();

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'sessions', 'legacy_trees', 'legacy_tree_members',
    'connected_lives', 'future_moment_makers', 'moments', 'drafts',
    'legacy_successors', 'legacy_frame_interests', 'password_reset_tokens',
    'account_recovery_attempts', 'weekly_moment_maker_settings',
    'weekly_moment_maker_weeks', 'weekly_moment_maker_selections',
    'family_relationship_milestones', 'family_calendar_events',
    'family_calendar_import_settings', 'family_calendar_reminders'
  )
ORDER BY table_name;

SELECT version, applied_at
FROM schema_migrations
WHERE version IN (
  '001_initial_schema', '002_profile_photo', '003_profile_details',
  '004_profile_words', '005_profile_fields', '006_legacy_control_visibility',
  '007_family_placeholders', '008_lives_notifications',
  '009_connected_lives_relationship_type', '010_account_recovery',
  '011_profile_birthplace', '012_profile_location_visibility',
  '013_weekly_moment_makers', '014_family_calendar'
)
ORDER BY version;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN (
    'username', 'profile_photo_data', 'bio', 'birthplace', 'location', 'personal_motto',
    'descriptor_one', 'descriptor_two', 'descriptor_three',
    'public_profile_photo', 'public_profile_bio', 'public_birthplace',
    'public_location', 'public_shared_moments',
    'public_connected_lives', 'public_legacy_tree',
    'public_future_moment_makers', 'public_personal_moments',
    'private_moment_access_requests', 'tree_participation',
    'family_contributions', 'connected_life_contributions',
    'require_moment_approval'
  )
ORDER BY column_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'connected_lives'
  AND column_name = 'relationship_type';
```

The table query should return all nineteen listed tables; the migration query should
return all fourteen migration versions when each has been applied, and the user column
query should return all profile and visibility columns. The profile migrations
add the photo, bio, location, motto, and descriptor fields used by `/my-profile`;
migration 006 adds the persisted Legacy Controls™ visibility and contribution
settings. Signup creates
the user and that user's Legacy Tree and membership in one transaction, then
writes a session.

Migration 014 must be applied before deploying Family Calendar™. Tree members
can create shared manual events and enable live imports; only owners and admins
can manage shared placeholder, future maker, and eligible connection dates.
Account holders choose whether to share their own full birthday and memorial
date with tree members. Both participants must opt in to share an anniversary
or relationship milestone, and both must remain members of the selected tree
with an accepted connection. Imports are evaluated on each request, so revoked
consent and removed membership take effect immediately. Year-only dates are not
imported, expected births are one-time events, and February 29 yearly events
appear only in leap years. Reminder settings are saved for future integration;
no reminder notifications are sent.

Run the calendar unit and rendering tests with
`node --test tests/family-calendar.test.mjs`. The database integration tests
additionally require a separately installed PGlite package: set
`FAMILY_CALENDAR_TEST_PGLITE` to its package path before running the command.
These tests use an in-memory database, not `DATABASE_URL`.

Migration 009 adds the shared Connected Lives™ relationship type. Existing
connections remain unclassified until either participant edits the relationship;
new requests require the recipient to select a type when accepting.

Migration 010 assigns existing users generated usernames; their email addresses
continue to work for sign-in. New users choose a username at signup.

Migration 011 adds an optional birthplace for the profile setup form. The form
also edits the existing display name, discoverability, descriptors, current
location, and personal motto without changing other Legacy Controls™.
Migration 012 adds public visibility controls for birthplace and current
location. Birthplace is hidden by default; current location remains visible by
default. Owners can still view and edit both fields. The location visibility
setting also controls whether current location appears in search results.

Migration 013 adds This Week's Moment Makers™ settings and selection history.
The first homepage request each UTC week selects up to the configured count of
opted-in, discoverable profiles, prioritizing those never featured and then
those featured least recently. Profiles selected in the previous four weeks
are excluded; the section may show fewer profiles. A member who opts out or
becomes private is removed from display immediately. Photo and location
visibility settings are respected.

An authorized database operator can change the number for future weekly
selections without a deployment:

```sql
UPDATE weekly_moment_maker_settings SET profile_count = 6 WHERE singleton = TRUE;
```

The allowed range is 0–100. Changes apply when the next week is first generated;
existing weekly selections are not replaced or expanded midweek. This setting
can be exposed through a secured admin interface later. Apply migration 013
before deployment; otherwise the homepage reports that featured profiles are
temporarily unavailable.

For database-backed rotation checks, apply the migrations to an empty,
disposable PostgreSQL database and run `tests/weekly-moment-makers.sql`.
The test rejects a database containing users or prior weekly selections and
rolls back its changes.

Family Placeholders use migration 007. Tree members can add a name and
relationship, optional years and notes, and link their own written moments when
publishing. The tree shows only the viewer's own linked moments; protected and
scheduled content is not displayed there. Placeholders have no accounts or
notifications. Photo and other media storage for placeholders is not part of
this feature.

To enable account recovery, set these server-side environment variables in
each deployment environment:

- `RESEND_API_KEY`: a Resend API key.
- `RECOVERY_FROM_EMAIL`: a sender address on a domain verified with Resend.
- `APP_URL`: the canonical application origin (HTTPS in production), used to
  construct password reset links.
- `RECOVERY_RATE_LIMIT_SECRET`: a private random secret of at least 32
  characters, used to hash addresses for per-address recovery throttling.

Password reset links expire after 30 minutes, can be used once, and revoke
existing sessions after a successful reset. Recovery requests are limited to
one per address and purpose per minute; configure additional edge-level abuse
and rate limiting before public deployment. The `account_recovery_attempts`
table stores keyed address hashes and timestamps; arrange periodic deletion of
old entries according to the deployment's retention policy.

Create an account at `/signup`, sign in at `/login`, and use the authenticated
dashboard at `/dashboard`. Passwords are stored as scrypt hashes; sessions use
opaque HTTP-only cookies and are persisted in PostgreSQL. Moments, drafts,
Legacy Trees, Connected Lives, Future Moment Makers, and Legacy Frame interest
are stored in PostgreSQL.

Email verification, additional abuse/rate limiting, backups, and the
platform's privacy and data-retention policies should be completed before
public production launch.
