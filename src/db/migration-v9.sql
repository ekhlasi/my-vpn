-- Migration v9: country-tagged clean-IP pools + multi-port scanning
--
-- Requirement #5 ("clean IP" auto-discovery) previously scanned one flat
-- built-in IP list on port 443 only. This migration reshapes clean_ips to
-- also track WHICH port was tested and WHICH pool (built-in 'global' or an
-- admin-defined custom pool, e.g. Germany/Turkey/UAE lists pasted into the
-- panel) the IP came from, so the same IP can have a separate healthy/
-- unhealthy row per port. SQLite/D1 can't change a table's PRIMARY KEY with
-- ALTER TABLE, so this rebuilds the table and copies existing rows across
-- (as port=443, pool='global', since that's what pre-v9 rows always were).
--
-- Run this the same way as previous migrations:
--   npx wrangler d1 execute <db-name> --remote --file=./src/db/migration-v9.sql

CREATE TABLE IF NOT EXISTS clean_ips_v9 (
  ip           TEXT NOT NULL,
  port         INTEGER NOT NULL DEFAULT 443,
  pool         TEXT NOT NULL DEFAULT 'global',
  latency_ms   INTEGER,
  healthy      INTEGER NOT NULL DEFAULT 0,
  last_checked INTEGER NOT NULL,
  last_error   TEXT,
  PRIMARY KEY (ip, port)
);

INSERT OR IGNORE INTO clean_ips_v9 (ip, port, pool, latency_ms, healthy, last_checked, last_error)
  SELECT ip, 443, 'global', latency_ms, healthy, last_checked, last_error FROM clean_ips;

DROP TABLE clean_ips;
ALTER TABLE clean_ips_v9 RENAME TO clean_ips;

CREATE INDEX IF NOT EXISTS idx_clean_ips_healthy ON clean_ips(healthy, latency_ms);

-- New settings: which Cloudflare HTTPS ports to scan, and the admin-defined
-- custom candidate pools (Germany/Turkey/UAE by default, empty until an
-- admin pastes IPs in and enables them — see docs/faq.md).
INSERT OR IGNORE INTO settings (key, value) VALUES ('clean_ip_scan_ports', '443');
INSERT OR IGNORE INTO settings (key, value) VALUES ('clean_ip_custom_pools', '[{"key":"de","label":"آلمان (Germany)","enabled":false,"ips":[],"builtin":false},{"key":"tr","label":"ترکیه (Turkey)","enabled":false,"ips":[],"builtin":false},{"key":"ae","label":"امارات (UAE)","enabled":false,"ips":[],"builtin":false}]');
