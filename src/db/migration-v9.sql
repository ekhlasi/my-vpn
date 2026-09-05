-- Migration v9: country grouping for the clean-IP scanner (admin panel)
--
-- Adds `colo` (Cloudflare data-center code, e.g. "FRA") and `country` (ISO
-- 3166-1 alpha-2, derived from colo — see src/services/cf-colos.ts) to the
-- existing clean_ips table, so the admin panel's "آی‌پی تمیز" tab can group
-- and filter discovered clean IPs by country the same way the Z-E-U-S
-- scanner's per-country proxy lists do.
--
-- Run this the same way as previous migrations:
--   npx wrangler d1 execute <db-name> --remote --file=./src/db/migration-v9.sql

ALTER TABLE clean_ips ADD COLUMN colo TEXT;
ALTER TABLE clean_ips ADD COLUMN country TEXT;

CREATE INDEX IF NOT EXISTS idx_clean_ips_country ON clean_ips(country, healthy);
