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
     `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/006_legacy_control_visibility.sql`.
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
     `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/006_legacy_control_visibility.sql`.
   - In the Neon Console, open the SQL Editor for the intended database. Run
     [`db/migrations/001_initial_schema.sql`](./db/migrations/001_initial_schema.sql)
     first, then run
     [`db/migrations/002_profile_photo.sql`](./db/migrations/002_profile_photo.sql)
     then [`db/migrations/003_profile_details.sql`](./db/migrations/003_profile_details.sql)
     then [`db/migrations/004_profile_words.sql`](./db/migrations/004_profile_words.sql)
     then [`db/migrations/005_profile_fields.sql`](./db/migrations/005_profile_fields.sql)
     then [`db/migrations/006_legacy_control_visibility.sql`](./db/migrations/006_legacy_control_visibility.sql)
     in order.
3. Set `DATABASE_URL` to the same pooled connection string in local
   `.env.local` and in Vercel Project Settings → Environment Variables for each
   deployment environment. Confirm Vercel points to the same Neon project and
   database where you ran the migration.
4. Redeploy after setting or changing Vercel environment variables.

All six migrations are idempotent and record their application in
`schema_migrations`. [`db/schema.sql`](./db/schema.sql) is the standalone
bootstrap copy of the current schema; use all six versioned migrations above for
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
    'legacy_successors', 'legacy_frame_interests'
  )
ORDER BY table_name;

SELECT version, applied_at
FROM schema_migrations
WHERE version IN (
  '001_initial_schema', '002_profile_photo', '003_profile_details',
  '004_profile_words', '005_profile_fields', '006_legacy_control_visibility'
)
ORDER BY version;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN (
    'profile_photo_data', 'bio', 'location', 'personal_motto',
    'descriptor_one', 'descriptor_two', 'descriptor_three',
    'public_profile_photo', 'public_profile_bio', 'public_shared_moments',
    'public_connected_lives', 'public_legacy_tree',
    'public_future_moment_makers', 'public_personal_moments',
    'private_moment_access_requests', 'tree_participation',
    'family_contributions', 'connected_life_contributions',
    'require_moment_approval'
  )
ORDER BY column_name;
```

The table query should return all ten listed tables; the migration query should
return all six migration versions when each has been applied, and the column
query should return all profile and visibility columns. The profile migrations
add the photo, bio, location, motto, and descriptor fields used by `/my-profile`;
migration 006 adds the persisted Legacy Controls™ visibility and contribution
settings. Signup creates
the user and that user's Legacy Tree and membership in one transaction, then
writes a session.

Create an account at `/signup`, sign in at `/login`, and use the authenticated
dashboard at `/dashboard`. Passwords are stored as scrypt hashes; sessions use
opaque HTTP-only cookies and are persisted in PostgreSQL. Moments, drafts,
Legacy Trees, Connected Lives, Future Moment Makers, and Legacy Frame interest
are stored in PostgreSQL.

Email verification, account recovery, abuse/rate limiting, backups, and the
platform's privacy and data-retention policies should be completed before
public production launch.
