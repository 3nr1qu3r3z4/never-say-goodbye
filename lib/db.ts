import "server-only";

import { neon } from "@neondatabase/serverless";

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL to a managed PostgreSQL connection string.",
    );
  }
  return neon(connectionString);
}
