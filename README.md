# Never Say Goodbye

Never Say Goodbye is a Moment Maker platform for preserving stories, moments,
and family connections.

## Run locally and deploy

The application uses Neon managed PostgreSQL for persistent data. It does not
create a local data directory or write account data to the app filesystem.

1. Create a PostgreSQL database with Neon.
2. Run [`db/schema.sql`](./db/schema.sql) in the Neon SQL Editor to create the
   tables and indexes.
3. Set `DATABASE_URL` to the database's pooled connection string in local
   `.env.local` and in Vercel Project Settings → Environment Variables for each
   deployment environment.
4. Deploy the application.

Create an account at `/signup`, sign in at `/login`, and use the authenticated
dashboard at `/dashboard`. Passwords are stored as scrypt hashes; sessions use
opaque HTTP-only cookies and are persisted in PostgreSQL. Moments, drafts,
Legacy Trees, Connected Lives, Future Moment Makers, and Legacy Frame interest
are stored in PostgreSQL.

Email verification, account recovery, abuse/rate limiting, backups, and the
platform's privacy and data-retention policies should be completed before
public production launch.
