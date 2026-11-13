# Never Say Goodbye

Never Say Goodbye is a Moment Maker platform for preserving stories, moments,
and family connections.

## Run locally

```powershell
npm install
npm run dev
```

The app creates a SQLite database at `data/never-say-goodbye.sqlite` on first
use. Set `DATABASE_PATH` to an absolute path on persistent storage to place it
elsewhere. The schema is maintained in `db/schema.sql`.

Create an account at `/signup`, sign in at `/login`, and use the authenticated
dashboard at `/dashboard`. Passwords are stored as scrypt hashes; sessions use
opaque, HTTP-only cookies and are persisted in the database. Moment drafts and
published moments are scoped to the signed-in account.

SQLite requires a persistent disk and a single application instance. For a
multi-instance or serverless production deployment, move the schema and data
access layer to a managed database with durable storage. Before public
production launch, add email verification, account recovery, abuse/rate
limiting, backups, and the platform's privacy and data-retention policies.
