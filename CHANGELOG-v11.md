# BNDMAX VPN — v11 fixes

## Admin panel / clean-IP stability

- Admin/control-plane requests no longer start background clean-IP discovery.
- Admin requests are excluded from the service quota counter, so opening or using the dashboard cannot create a D1 write queue or consume the VPN request budget.
- Daily quota accounting now uses an atomic `request_quota` D1 table instead of a read-modify-write on the shared `settings` row.
- Added `src/db/migration-v11.sql`; the existing CI setup script already discovers and applies numbered migrations automatically.
- Added backward-compatible fallback to the legacy settings counter if migration v11 has not landed yet.
- Clean-IP result writes and approval changes now use D1 batches instead of one write per IP.
- Admin API responses and admin HTML are marked `no-store` to prevent stale dashboard code/data after deployment.
- Dashboard API requests use same-origin credentials, `cache: no-store`, and a 15-second timeout so a genuinely stuck backend produces a visible error instead of an endless loading state.

The clean-IP generation logic itself is preserved: `host`/`sni` remain the Worker hostname and a tested IP is used only as the TCP connect address. Admin approval behavior is unchanged.
