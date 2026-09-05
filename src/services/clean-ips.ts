// ==================== Automatic "clean IP" discovery (requirement #5) ====================
//
// Background: on a VLESS-over-WebSocket-over-TLS config that runs on a
// Cloudflare Worker, the address the client actually dials (`add=`) does NOT
// have to be the worker's own domain — Cloudflare's edge terminates TLS by
// SNI and then routes the HTTP/WS request by the `Host` header, regardless
// of which of Cloudflare's own anycast IPs was physically dialed. So as long
// as `host=`/`sni=` still name the real worker domain, `add=` can be any
// live Cloudflare edge IP, on any of Cloudflare's supported HTTPS ports —
// this file finds the currently-clean (ip, port) combinations automatically.
//
// IMPORTANT, HONEST LIMITATION (please read before turning `auto_clean_ip_enabled` on):
// the test below runs FROM this Worker, i.e. from inside Cloudflare's own
// network. It can only ever prove "Cloudflare can reach this edge IP on this
// port" — it has no way to prove "an Iranian ISP can reach this edge IP",
// because Iranian ISP-level blocking happens on the path between the ISP and
// Cloudflare, a path this Worker never travels. Two things narrow that gap
// but don't close it:
//   1. Testing across MULTIPLE ports (not just 443) — some ISPs filter by
//      port+SNI together, so a range blocked on 443 sometimes still opens on
//      2053/2083/2087/2096/8443.
//   2. Testing across MULTIPLE country-tagged candidate pools — the built-in
//      "جهانی" pool is a generic spread of Cloudflare's published ranges, but
//      admins can also paste in their own curated IP lists (e.g. ranges
//      commonly shared in Iranian VPN/Telegram communities as "clean for
//      Germany/Turkey/UAE-facing traffic") under "custom pools" in the panel.
//      Those lists were presumably validated by people with an actual
//      Iranian vantage point — this file still re-verifies them from
//      Cloudflare's side (so entries that have gone stale/blocked get
//      dropped), but it cannot invent that vantage point itself.
// For genuinely reliable results, healthy=true here should be read as "worth
// trying", not "confirmed working for every Iranian ISP" — hence
// `auto_clean_ip_enabled` staying an explicit, off-by-default opt-in.

export interface CleanIpResult {
  ip: string
  port: number
  pool: string
  healthy: boolean
  latencyMs: number | null
  error: string | null
}

export interface CleanIpCandidate {
  ip: string
  /** Which pool this candidate came from — 'global' (built-in) or a custom pool key. */
  pool: string
}

/** A scannable pool of candidate IPs, either built-in or admin-defined. */
export interface CleanIpPool {
  key: string
  label: string
  enabled: boolean
  /** Only present/editable for custom (non-built-in) pools. */
  ips: string[]
  builtin: boolean
}

/**
 * Cloudflare's officially supported HTTPS-through-the-CDN ports. These are
 * the only ports Cloudflare will proxy TLS traffic on for a normal
 * (non-Spectrum) zone, so they're the only ports valid for a VLESS+WS+TLS
 * "clean IP" config — including for Iranian users, since the client still
 * connects straight to Cloudflare's edge on one of these, same as anywhere
 * else. 443 is the default; the rest exist because some ISPs' DPI rules key
 * off port+SNI together, so a range that's throttled on 443 is occasionally
 * still open on one of the others.
 */
export const IRAN_VALID_PORTS: number[] = [443, 2053, 2083, 2087, 2096, 8443]

export const DEFAULT_SCAN_PORTS: number[] = [443]

/**
 * Built-in "global" candidate pool: a generic spread of Cloudflare's
 * published anycast ranges (see https://www.cloudflare.com/ips/), so a block
 * on any single range doesn't zero out every candidate. This is always
 * available and can't be edited from the panel — admins who want to scan
 * against country-specific lists add those as custom pools instead (see
 * CleanIpPool / getCleanIpPools in db/queries.ts).
 */
export const BUILTIN_GLOBAL_IPS: string[] = [
  '104.16.0.0', '104.16.1.0', '104.16.2.0', '104.16.123.0', '104.16.200.0',
  '104.17.0.0', '104.17.1.0', '104.18.0.0', '104.19.0.0', '104.20.0.0',
  '104.21.0.0', '104.22.0.0', '104.24.0.0', '104.24.100.0', '104.25.0.0',
  '104.26.0.0', '104.27.0.0', '104.28.0.0',
  '172.64.0.0', '172.64.32.0', '172.64.64.0', '172.64.100.0', '172.64.150.0',
  '172.65.0.0', '172.66.0.0', '172.67.0.0', '172.67.50.0', '172.67.100.0',
  '172.67.150.0', '172.67.200.0', '172.68.0.0', '172.69.0.0', '172.70.0.0',
  '188.114.96.0', '188.114.97.0', '188.114.98.0', '188.114.99.0',
  // Additional published Cloudflare anycast ranges — spreading candidates
  // across more ranges means an ISP-level block on any single range still
  // leaves plenty of other candidates to discover as healthy.
  '103.21.244.0', '103.21.245.0', '103.21.246.0',
  '103.22.200.0', '103.22.201.0', '103.22.202.0',
  '103.31.4.0', '103.31.5.0', '103.31.6.0',
  '108.162.192.0', '108.162.200.0', '108.162.210.0', '108.162.220.0',
  '131.0.72.0', '131.0.73.0',
  '141.101.64.0', '141.101.80.0', '141.101.100.0', '141.101.120.0',
  '162.158.0.0', '162.158.50.0', '162.158.100.0', '162.158.150.0', '162.158.200.0',
  '173.245.48.0', '173.245.58.0',
  '190.93.240.0', '190.93.245.0', '190.93.250.0',
  '197.234.240.0', '197.234.241.0',
  '198.41.128.0', '198.41.200.0',
]

/**
 * Default (empty) custom-pool skeleton the admin panel starts from — labeled
 * for Germany/Turkey/UAE since those are the three the panel highlights, but
 * admins can rename/add/remove pools freely (see CleanIpPool). Empty by
 * default: no fabricated IP list is shipped for these, since a wrong guess
 * at "which Cloudflare IPs geolocate to which country" is worse than no
 * guess — admins paste in lists they actually trust (e.g. ones already
 * being tested by real users in-country), and this file re-verifies them
 * from Cloudflare's side before anything gets marked healthy.
 */
export const DEFAULT_CUSTOM_POOLS: CleanIpPool[] = [
  { key: 'de', label: 'آلمان (Germany)', enabled: false, ips: [], builtin: false },
  { key: 'tr', label: 'ترکیه (Turkey)', enabled: false, ips: [], builtin: false },
  { key: 'ae', label: 'امارات (UAE)', enabled: false, ips: [], builtin: false },
]

const TEST_TIMEOUT_MS = 4000

/** Tests one candidate (ip, port) by dialing it directly while keeping SNI/Host on `domain`. */
async function testOneCandidate(domain: string, candidate: CleanIpCandidate, port: number): Promise<CleanIpResult> {
  const { ip, pool } = candidate
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS)
    const portSuffix = port === 443 ? '' : `:${port}`
    const res = await fetch(`https://${domain}${portSuffix}/cdn-cgi/trace`, {
      method: 'GET',
      signal: controller.signal,
      // @ts-ignore -- Cloudflare Workers-specific fetch option, not in lib.dom types
      cf: { resolveOverride: ip },
    })
    clearTimeout(timer)
    const latencyMs = Date.now() - start
    if (!res.ok) return { ip, port, pool, healthy: false, latencyMs, error: `HTTP ${res.status}` }
    return { ip, port, pool, healthy: true, latencyMs, error: null }
  } catch (err: any) {
    return { ip, port, pool, healthy: false, latencyMs: Date.now() - start, error: err?.message || 'network error' }
  }
}

/**
 * Tests a slice of the (candidate × port) cartesian product — not all of it
 * in one go, since Workers subrequest limits and per-invocation CPU time
 * make testing dozens of combinations in one pass risky. Called on a
 * rotating offset (see runCleanIpDiscovery in db/queries.ts) so the full
 * list gets re-verified on a cycle instead of going stale — important
 * against active, fast-changing IP-based blocking. batchSize=10 stays well
 * under the ~50 subrequest ceiling on Workers free/paid plans even with a
 * couple of other subrequests happening in the same request.
 */
export async function discoverCleanIpsBatch(
  domain: string,
  candidates: CleanIpCandidate[],
  ports: number[],
  offset: number,
  batchSize = 10,
): Promise<CleanIpResult[]> {
  const safeCandidates = candidates.length ? candidates : BUILTIN_GLOBAL_IPS.map((ip) => ({ ip, pool: 'global' }))
  const safePorts = ports.length ? ports : DEFAULT_SCAN_PORTS
  const total = safeCandidates.length * safePorts.length
  if (total === 0) return []

  const jobs: { candidate: CleanIpCandidate; port: number }[] = []
  for (let i = 0; i < Math.min(batchSize, total); i++) {
    const idx = (offset + i) % total
    const candidate = safeCandidates[Math.floor(idx / safePorts.length)]
    const port = safePorts[idx % safePorts.length]
    jobs.push({ candidate, port })
  }
  return Promise.all(jobs.map(({ candidate, port }) => testOneCandidate(domain, candidate, port)))
}
