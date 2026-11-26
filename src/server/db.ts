import { Database } from 'bun:sqlite';

/** Where the database lives. Override with the DB_PATH environment variable. */
const DB_PATH = process.env.DB_PATH ?? 'webtrio.db';

export const db = new Database(DB_PATH, { create: true, strict: true });

db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

// guests have no password and their names aren't unique, they only exist so
// that the same person can be recognised again later
db.run(`
  CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

// exactly one of user_id / guest_id is set
db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    guest_id INTEGER REFERENCES guests(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    CHECK ((user_id IS NULL) != (guest_id IS NULL))
  )
`);
