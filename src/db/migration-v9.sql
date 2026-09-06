-- Migration v9: remove automatic "clean IP" scanning, replace with a
-- manually-entered healthy IP:port list (requirement #5)
--
-- The old clean_ips table (ip, latency_ms, healthy, last_checked, last_error)
-- stored results from an in-worker scanner that tested Cloudflare candidate
-- IPs against this worker's own domain. That scanner is gone entirely
-- (src/services/clean-ips.ts has been deleted). This migration replaces the
-- table with a much simpler one that just stores admin-entered IP:port
-- pairs — no scanning, no test results, no scheduler.
--
-- Safe to run whether or not you ever ran migration-v6.sql: DROP TABLE IF
-- EXISTS is a no-op on a fresh deploy where clean_ips doesn't exist yet
-- (schema.sql already creates the new shape directly).
--
-- Run this the same way as previous migrations:
--   npx wrangler d1 execute <db-name> --remote --file=./src/db/migration-v9.sql

DROP TABLE IF EXISTS clean_ips;

CREATE TABLE IF NOT EXISTS clean_ips (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL,
  port       INTEGER NOT NULL DEFAULT 443,
  note       TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clean_ips_ip_port ON clean_ips(ip, port);

-- The old auto_clean_ip_enabled setting is replaced by
-- clean_ip_override_enabled; both default to off ('0') so this is optional,
-- but carrying over an admin's existing choice avoids surprising a
-- deployment that had already turned the old toggle on.
INSERT OR IGNORE INTO settings (key, value)
SELECT 'clean_ip_override_enabled', value FROM settings WHERE key = 'auto_clean_ip_enabled';
DELETE FROM settings WHERE key IN ('auto_clean_ip_enabled', 'clean_ip_scan_offset', 'last_clean_ip_scan');
