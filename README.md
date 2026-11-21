# Never Say Goodbye

Never Say Goodbye is a Moment Maker platform for preserving stories, moments,
and family connections.

## Shared Moments

Signed-in members can view their own Shared Moments and moments addressed to
their accepted Connected Lives or members of a shared Legacy Tree at `/moments`.
Public Shared Moments can be viewed when the author's profile and Shared
Moments visibility settings permit it. Authors can delete their own Shared
Moments from the actions menu; editing published moments is not yet available.
One photo per moment can be selected, optimized, and saved with a draft or
published moment. Photos on Shared Moments use the existing viewing permissions;
other moment types do not yet have a viewing page. For older drafts containing
only a filename, select the original photo again. Older published moments
cannot be edited, so recreate them to include the original photo.
Inputs up to 20 MB are optimized to at most 640 KB. Shared Moments also support
one MP4, MOV, or M4V video up to 100 MiB, uploaded directly to private Blob
storage. Playback uses the same Shared Moment access check and depends on the
browser supporting the video's codec; no transcoding is performed. Older
filename-only video selections must be uploaded again. Protected and scheduled
unlocks, Future Moment Maker recipients, and audio uploads are not implemented.

### Video deployment

Apply migration 021 before deploying. Connect a **private** Vercel Blob store
and configure `BLOB_READ_WRITE_TOKEN` for each environment: the client upload
token flow requires it. Configure `CRON_SECRET` and verify the daily
`/api/cron/moment-videos` job succeeds. On other hosts, invoke that endpoint
daily with `Authorization: Bearer <CRON_SECRET>`.

Uploaded videos are kept with saved Shared Moment drafts or published moments.
Deleting a moment makes its video inaccessible immediately; physical Blob
deletion occurs on the next successful cleanup job. Unreferenced uploads are
removed after seven days. Monitor and retry failed jobs. Blob storage and
playback incur provider charges.

The Moments in the Making card on My Legacy shows up to five recent Shared
Moments from accepted Connected Lives and members of a shared Legacy Tree,
subject to the same viewing permissions.
The feed identifies uploaded videos, photos, and written messages within each
moment; it does not include drafts, private moments, or separate messages.

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
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/014_family_calendar.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/015_connected_lives_directory.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/016_account_status.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/017_profile_visits.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/018_email_preferences.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/019_site_analytics.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/020_honored_lives.sql`
     then
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/021_moment_videos.sql`.
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
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/014_family_calendar.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/015_connected_lives_directory.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/016_account_status.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/017_profile_visits.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/018_email_preferences.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/019_site_analytics.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/020_honored_lives.sql`
     then
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/021_moment_videos.sql`.
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
     then [`db/migrations/015_connected_lives_directory.sql`](./db/migrations/015_connected_lives_directory.sql)
     then [`db/migrations/016_account_status.sql`](./db/migrations/016_account_status.sql)
     then [`db/migrations/017_profile_visits.sql`](./db/migrations/017_profile_visits.sql)
     then [`db/migrations/018_email_preferences.sql`](./db/migrations/018_email_preferences.sql)
     then [`db/migrations/019_site_analytics.sql`](./db/migrations/019_site_analytics.sql)
     then [`db/migrations/020_honored_lives.sql`](./db/migrations/020_honored_lives.sql)
     then [`db/migrations/021_moment_videos.sql`](./db/migrations/021_moment_videos.sql)
     in order.
3. Set `DATABASE_URL` to the same pooled connection string in local
   `.env.local` and in Vercel Project Settings → Environment Variables for each
   deployment environment. Confirm Vercel points to the same Neon project and
   database where you ran the migration.
4. Redeploy after setting or changing Vercel environment variables.

All twenty migrations are idempotent and record their application in
`schema_migrations`. [`db/schema.sql`](./db/schema.sql) is the standalone
bootstrap copy of the current schema; use all twenty versioned migrations above for
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
    'family_calendar_import_settings', 'family_calendar_reminders',
    'connected_lives_person_tags', 'account_status_history', 'profile_visits',
    'email_preferences', 'site_analytics_visitors',
    'site_analytics_visitor_days', 'site_analytics_daily', 'honored_lives'
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
  '013_weekly_moment_makers', '014_family_calendar',
  '015_connected_lives_directory', '016_account_status', '017_profile_visits',
  '018_email_preferences', '019_site_analytics', '020_honored_lives',
  '021_moment_videos'
)
ORDER BY version;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN (
    'username', 'account_status', 'profile_photo_data', 'bio', 'birthplace', 'location', 'personal_motto',
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

The table query should return all twenty-three listed tables; the migration query should
return all eighteen migration versions when each has been applied, and the user column
query should return all profile and visibility columns. The profile migrations
add the photo, bio, location, motto, and descriptor fields used by `/my-profile`;
migration 006 adds the persisted Legacy Controls™ visibility and contribution
settings. Signup creates
the user and that user's Legacy Tree and membership in one transaction, then
writes a session.

Migration 018 adds per-user email notification preferences. Apply it before
deploying the Email Preferences page. Until a user saves a selection, all
categories are enabled by default. The page uses the account email address and
does not send email or enable notification delivery.

Migration 016 adds account statuses (`active`, `inactive`, `memorialized`, and
`frozen`) and records subsequent status changes in `account_status_history`.
Existing and newly created users default to `active`; no initial history entries
are backfilled. The trigger records the database role, not the authenticated
person: `actor_user_id` remains null until a future authenticated transition
workflow provides reliable attribution. Apply the migration before deploying
the owner-only status display on My Profile.
Migration 016 refuses to run for the first time if an account-status column or
history table already exists without its migration record; inspect any such
schema conflict before proceeding.

Run `node --test tests/account-status.test.mjs` for the display test. The
disposable-database integration test additionally requires a separately
installed PGlite package; set `ACCOUNT_STATUS_TEST_PGLITE` to its package path.

This phase does **not** enforce login restrictions, revoke sessions, change
visibility, or provide status transitions. Do not set accounts to non-active
statuses until the corresponding access controls are implemented and tested.
Status history alone does not prevent deletion of users without history, and
existing cascading foreign keys are unchanged.

Later phases should enforce status on login, session validation, and password
recovery; serialize transitions with session creation and revoke existing
sessions and reset tokens atomically when access is disabled. A settings page
can then show the current status and explain preservation, privacy, and recovery
before offering confirmed transitions. Memorialization requests, approvals, and
administrative recovery require separate authorized, audited workflows.
Reactivation, memorialization approval, and frozen-profile visibility remain
policy decisions; future transitions must attribute the authenticated actor and
must not grant additional access to preserved content.

Migration 017 adds private, per-viewer profile-visit days for Frequently Visited.
Only signed-in visits to accessible profiles are recorded, at most once per UTC
day; suggestions are separate accepted Connected Lives and do not create visits.
The dashboard considers the current UTC day and previous 89 days. The daily
Vercel cron in `vercel.json` deletes older rows; late or failed jobs can delay
physical deletion and must be monitored and retried.

Before enabling this feature, apply migration 017, configure a strong Vercel
`CRON_SECRET`, deploy, and verify that the `/api/cron/profile-visits` job is
enabled and succeeds. Then set `FREQUENT_VISITS_ENABLED=true` and redeploy.
Tracking is disabled by default; enabling it without `CRON_SECRET` fails
explicitly. Non-Vercel deployments must arrange an authenticated daily GET to
that endpoint with `Authorization: Bearer <CRON_SECRET>`. Do not log the secret,
visit records, or identifiers. The retention job continues to run when tracking
is disabled, so existing records can expire.

### Founder dashboard and beta analytics

Set `FOUNDER_USER_IDS` to a comma-separated allowlist of immutable `users.id`
values for the founder accounts, and redeploy. An empty or missing allowlist
denies access. The My Profile menu and `/admin-dashboard` enforce the same
server-side check; the page does not provide editing or management tools.

Site analytics is disabled by default. Family Beta consent is collected
outside the application: enable tracking only when that consent applies to
all visitors to the deployment. First apply migration 019, configure a strong
`CRON_SECRET`, deploy, and verify that the daily `/api/cron/site-analytics`
job runs successfully. Set `SITE_ANALYTICS_ENABLED=true` and redeploy only
afterward. The endpoint fails closed if the secret is missing. On non-Vercel
deployments, arrange an authenticated daily GET to the cron endpoint using
`Authorization: Bearer <CRON_SECRET>`. Monitor and retry failed jobs: a late
job delays physical deletion. The job continues when tracking is disabled.

The tracker uses first-party, HTTP-only random browser and 30-minute visit
cookies. It stores no IP address, URL, or user ID. A visit is a browser session
separated by 30 minutes without a page navigation; blocked scripts/cookies,
shared devices and bots affect counts. Tracking begins only when enabled.
Anonymous visitor-day detail and signup attribution expire after 90 days;
anonymous daily visit totals remain for the lifetime total. The 90-day
conversion estimate is attributed signup browsers divided by unique
visitors in that window, not a strict cohort or a ratio of lifetime signups to
visits. Historical signups and signups without a tracked browser cannot be
attributed. The platform funnel combines a 90-day visitor count with current
account counts and is not a cohort funnel. Profiles count as complete only
when a profile photo and non-empty bio are present. Current profile photos
are measurable; moment attachment filenames do not represent stored uploads.
The Founder Overview counts unique browsers for today, the current calendar
week (Monday onward), and the current calendar month in UTC. Its first-moment
count is members with at least one published moment, and established Connected
Lives are accepted connections.

### Honored Lives™

Apply migration 020 before deploying the Legacy Tree or Honored Lives page.
Tree owners and administrators can honor an existing Family Placeholder or
create a new one. The name, relationship and birth date belong to the
placeholder; the passing date, short story and optional photo belong to its
Honored Life. Selecting an existing placeholder can update its details and
its birth date may appear on the tree calendar when imports are enabled.
Passing dates are not automatically imported as memorial dates. All tree
members can see the record; it is not publicly searchable. V1 has no editing,
contributor or user-account memorialization workflow. Removing the underlying
placeholder also removes its Honored Life under the existing cascade rules.

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

Migration 015 must be applied before deploying the Connected Lives™ directory.
Existing relationship types and connection dates are not backfilled. New
acceptances record an acceptance timestamp; older connections without one show
that the date is unavailable. Parent and Child labels are reciprocal for the
two participants. Tags describe a specific participant and are shared with,
and editable by, both participants in that accepted connection. Birthday years
are shown only when the person shares their birthday and both people belong to
the same Legacy Tree™. Future Moment Maker records are visible only to their
owner; their associated tree is shown only while the owner belongs to it.
Run `node --test tests/connected-lives-directory.test.mjs` for directory tests.
The disposable-database integration test additionally requires a separately
installed PGlite package; set `CONNECTED_LIVES_TEST_PGLITE` to its package path.

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

Temporary profile-photo diagnostics appear in the browser console with the
`[profile-photo]` prefix; server save stages appear in server logs. They record
stages and error types, not file names or image contents. A header-read failure
occurs before upload; an image is reported opened only after decoding succeeds.

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

The Legacy Tree page shows trees the signed-in user belongs to, with members,
Future Moment Makers, and placeholders grouped in a membership map for each
tree. The map does not infer family relationships or a parent-child hierarchy;
relationship labels are shown as entered. A successful addition links back to
the selected tree. New signups normally receive a tree automatically;
users without a membership can create one from the page. Signed-out visitors
are prompted to sign up or sign in.

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
