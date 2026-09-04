-- Migration v10: per-slot config enable/disable + admin-supplied candidate IPs.
-- Run once against an already-deployed database:
--   npx wrangler d1 execute <db-name> --remote --file=./src/db/migration-v10.sql
-- Fresh databases created from schema.sql already have all of this.

INSERT OR IGNORE INTO settings (key, value) VALUES ('slot_auto_1_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('slot_auto_2_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('slot_approved_1_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('slot_approved_2_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('slot_approved_3_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('slot_trial_enabled', '1');

CREATE TABLE IF NOT EXISTS custom_candidate_ips (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  value      TEXT NOT NULL UNIQUE,
  label      TEXT,
  added_at   INTEGER NOT NULL
);
