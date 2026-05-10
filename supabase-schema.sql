-- Run this in Supabase Dashboard → SQL Editor
CREATE TABLE IF NOT EXISTS rentflow_state (
  id TEXT PRIMARY KEY,
  db_json JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
