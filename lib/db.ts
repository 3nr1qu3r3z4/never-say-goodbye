import "server-only";

import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const globalForDatabase = globalThis as typeof globalThis & {
  nsgDatabase?: Database.Database;
};

function createDatabase() {
  const databasePath =
    process.env.DATABASE_PATH ??
    path.join(process.cwd(), "data", "never-say-goodbye.sqlite");

  mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  return database;
}

export const db = globalForDatabase.nsgDatabase ?? createDatabase();
db.exec(readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8"));

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.nsgDatabase = db;
}
