-- Migration v11: atomic daily request quota counter.
--
-- The old implementation stored usage_quota_count in the generic settings
-- table and performed a read-modify-write for every request. Under concurrent
-- traffic that creates a hot-row write queue and can make the admin dashboard
-- appear stuck. The dedicated table below lets SQLite/D1 increment the daily
-- counter atomically with one UPSERT.
CREATE TABLE IF NOT EXISTS request_quota (
  day   TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
