import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH || './data/scrape-yard.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  team TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER
);

CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  team TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keywords_json TEXT NOT NULL,
  cron TEXT NOT NULL,
  filter_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  last_run_at INTEGER,
  next_run_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner_id);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_job ON runs(job_id, started_at DESC);

CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  source TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  snippet TEXT,
  image_url TEXT,
  tag TEXT,
  published_at INTEGER,
  fetched_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  url_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_results_job ON results(job_id, fetched_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_results_unique ON results(job_id, url_hash);
`);

export function now() { return Date.now(); }
