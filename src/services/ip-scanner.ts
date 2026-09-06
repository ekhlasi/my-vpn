// ==================== In-panel Clean-IP / rented-proxy scanner ====================
//
// This replaces the old `clean-ip-scanner/server.py` local tool: instead of the
// admin running a separate Python server on their own machine and pasting a
// Cloudflare API token into it, the exact same two checks now run *inside this
// Worker* and are triggered from a button in the "🌐 آی‌پی‌های سالم" tab.
//
// Two modes, matching the old tool exactly:
//  - "socks4": connects to one of YOUR entries in the healthy-IP list (D1 +
//    src/data/rented-clean-ips.ts, via listCleanIps()) and performs a real
//    SOCKS4 CONNECT handshake toward a fixed test target, just to prove the
//    proxy itself is alive and measure its ping.
//  - "sni": performs a real TLS handshake straight to that same ip:port, but
//    presents THIS worker's own domain as the SNI (via Socket.startTls's
//    `expectedServerHostname`) on each of Cloudflare's TLS ports, then sends a
//    plain HTTP GET and checks for a valid HTTP response. This is the
//    "clean IP" check: it tells you whether that address can actually reach
//    your worker over a given port/SNI combination.
//
// No Cloudflare API token and no external server are needed anymore: because
// this code runs as part of the deployed worker, the SNI it needs is simply
// the hostname of the incoming admin request (the worker's own domain) —
// there is nothing left to "detect".
//
// Nothing here ever contacts a third party for a list of addresses — it only
// ever tests the ip:port pairs already present in the admin's own healthy-IP
// list, exactly like the old local tool only ever read proxy/*.txt.

import { connect } from 'cloudflare:sockets'
import { proxiesForCountry, type DiscoveryProxy } from '../data/discovery-proxies'

export interface ScanTarget {
  ip: string
  port: number
  /** Cosmetic country tag copied from the source clean_ips/rented-clean-ips.ts
   *  row this target came from (see countries.ts) — never guessed from the
   *  scan itself, since Workers can't detect an exit country. */
  country?: string | null
}

export interface ScanResult {
  ip: string
  port: number
  success: boolean
  ping?: number
  error?: string
  /** Echoes ScanTarget.country so the dashboard can pre-fill the flag when
   *  adding a healthy result back to the list, instead of asking the admin
   *  to re-pick a country it already told us about. */
  country?: string | null
}

export type ScanMode = 'socks4' | 'sni'

/** Same TLS ports Cloudflare terminates on, and that the subscription/config generator assumes. */
export const SNI_PORTS: number[] = [443, 2053, 2083, 2087, 2096, 8443]

const HANDSHAKE_TIMEOUT_MS = 4000
const SCAN_CONCURRENCY = 8

// Fixed CONNECT target used only to measure the proxy's own health/ping —
// mirrors TEST_TARGET_HOST/PORT in the old server.py exactly.
const SOCKS4_TEST_TARGET = { ip: '1.1.1.1', port: 80 }

function timeoutRejection<T>(ms: number, label: string): Promise<T> {
  return new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(label)), ms)
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([promise, timeoutRejection<T>(ms, label)])
}

function ipv4ToBytes(ip: string): Uint8Array {
  const parts = ip.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error('این آدرس IPv4 معتبر نیست (اسکنر فعلاً فقط IPv4 را پشتیبانی می‌کند)')
  }
  return Uint8Array.from(parts)
}

async function closeQuietly(socket: Socket | undefined): Promise<void> {
  if (!socket) return
  try {
    await socket.close()
  } catch {
    // already closed/errored — nothing to do
  }
}

/** Real SOCKS4 handshake against one of the admin's own rented proxy servers. Only measures health/ping. */
export async function socks4Handshake(ip: string, port: number): Promise<ScanResult> {
  const start = Date.now()
  let socket: Socket | undefined
  try {
    socket = connect({ hostname: ip, port })
    await withTimeout(socket.opened, HANDSHAKE_TIMEOUT_MS, 'اتصال زمان‌بر شد (timeout)')

    const writer = socket.writable.getWriter()
    const reader = socket.readable.getReader()
    try {
      // SOCKS4 CONNECT request: VN=4, CD=1(CONNECT), DSTPORT (2B big-endian),
      // DSTIP (4B), USERID (empty) + NULL terminator.
      const packet = new Uint8Array(9)
      packet[0] = 0x04
      packet[1] = 0x01
      packet[2] = (SOCKS4_TEST_TARGET.port >> 8) & 0xff
      packet[3] = SOCKS4_TEST_TARGET.port & 0xff
      packet.set(ipv4ToBytes(SOCKS4_TEST_TARGET.ip), 4)
      packet[8] = 0x00

      await writer.write(packet)
      const { value, done } = await withTimeout(reader.read(), HANDSHAKE_TIMEOUT_MS, 'پاسخی از پروکسی دریافت نشد (timeout)')
      const ping = Date.now() - start

      if (done || !value || value.length < 2) {
        return { ip, port, success: false, error: 'پاسخ ناقص از سرور' }
      }
      if (value[0] === 0x00 && value[1] === 0x5a) {
        return { ip, port, success: true, ping }
      }
      return { ip, port, success: false, error: `SOCKS4 رد شد (کد ${value[1] ?? '؟'})` }
    } finally {
      writer.releaseLock()
      reader.releaseLock()
    }
  } catch (err) {
    return { ip, port, success: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    await closeQuietly(socket)
  }
}

/**
 * Real TLS handshake to ip:port with `sni` as the presented SNI/Host — the
 * exact "clean IP" mechanism: the TCP connection goes to `ip`, but Cloudflare
 * routes the request by SNI/Host, so this only ever reaches YOUR OWN worker
 * (never a third party), and only tells you whether that ip:port combination
 * is currently a usable path *to your own deployment*.
 */
export async function sniHandshake(ip: string, port: number, sni: string): Promise<ScanResult> {
  const start = Date.now()
  let plainSocket: Socket | undefined
  let tlsSocket: Socket | undefined
  try {
    plainSocket = connect({ hostname: ip, port }, { secureTransport: 'starttls' })
    await withTimeout(plainSocket.opened, HANDSHAKE_TIMEOUT_MS, 'اتصال زمان‌بر شد (timeout)')
    tlsSocket = plainSocket.startTls({ expectedServerHostname: sni })

    const writer = tlsSocket.writable.getWriter()
    const reader = tlsSocket.readable.getReader()
    try {
      const req = `GET / HTTP/1.1\r\nHost: ${sni}\r\nUser-Agent: clean-ip-scanner\r\nConnection: close\r\n\r\n`
      await writer.write(new TextEncoder().encode(req))

      const { value, done } = await withTimeout(reader.read(), HANDSHAKE_TIMEOUT_MS, 'پاسخی دریافت نشد (timeout)')
      const ping = Date.now() - start

      if (done || !value) {
        return { ip, port, success: false, error: 'پاسخی دریافت نشد' }
      }
      const text = new TextDecoder().decode(value)
      if (text.startsWith('HTTP/1.')) {
        return { ip, port, success: true, ping }
      }
      return { ip, port, success: false, error: 'پاسخ HTTP نامعتبر' }
    } finally {
      writer.releaseLock()
      reader.releaseLock()
    }
  } catch (err) {
    return { ip, port, success: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    await closeQuietly(tlsSocket)
    await closeQuietly(plainSocket)
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++
      if (i >= items.length) return
      const item = items[i]
      if (item === undefined) return
      results[i] = await fn(item)
    }
  }
  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}

function sortResults(results: ScanResult[]): ScanResult[] {
  return [...results].sort((a, b) => {
    if (a.success !== b.success) return a.success ? -1 : 1
    return (a.ping ?? 999999) - (b.ping ?? 999999)
  })
}

/** Runs the SOCKS4 health check against every given target (one result each). */
export async function scanSocks4(targets: ScanTarget[]): Promise<ScanResult[]> {
  const results = await mapWithConcurrency(targets, SCAN_CONCURRENCY, async (t) => ({
    ...(await socks4Handshake(t.ip, t.port)),
    country: t.country ?? null,
  }))
  return sortResults(results)
}

/** Runs the SNI/TLS check against every given target on every port in SNI_PORTS. */
export async function scanSni(targets: ScanTarget[], sni: string): Promise<ScanResult[]> {
  const jobs: ScanTarget[] = []
  for (const t of targets) {
    for (const port of SNI_PORTS) jobs.push({ ip: t.ip, port, country: t.country })
  }
  const results = await mapWithConcurrency(jobs, SCAN_CONCURRENCY, async (j) => ({
    ...(await sniHandshake(j.ip, j.port, sni)),
    country: j.country ?? null,
  }))
  return sortResults(results)
}

// ==================== Discovery (stage 1): proxy -> DoH -> candidate CF edge IP ====================
//
// This is intentionally one-directional and must never be reversed:
//   1) DISCOVER through a SOCKS4 proxy in a given country (DISCOVERY_PROXIES):
//      tunnel a DoH query for `sni`'s A record through it. Because the query
//      leaves Cloudflare's DNS resolver from inside that proxy's network, the
//      answer is the Cloudflare edge IP specific to that network path — a
//      candidate, nothing more.
//   2) VALIDATE every candidate directly (sniHandshake, no proxy involved) —
//      exactly what actually happens when a real user connects, so this is
//      the only step allowed to decide "healthy" or not.

const DOH_IP = '1.1.1.1'
const DOH_PORT = 443
const DOH_SNI = 'cloudflare-dns.com'
const DISCOVERY_TIMEOUT_MS = 5000
const DISCOVERY_CONCURRENCY = 8

export interface DiscoveryDetail {
  proxy: string
  country: string
  success: boolean
  candidates: string[]
  error?: string
}

function parseDohJsonAnswers(text: string): string[] {
  const idx = text.indexOf('\r\n\r\n')
  const body = idx === -1 ? text : text.slice(idx + 4)
  try {
    const data = JSON.parse(body) as { Answer?: Array<{ type?: number; data?: string }> }
    const out: string[] = []
    for (const a of data.Answer ?? []) {
      if (a.type === 1 && a.data && !out.includes(a.data)) out.push(a.data)
    }
    return out
  } catch {
    return []
  }
}

/** Tunnels a SOCKS4 CONNECT to DOH_IP:443 through `proxy`, then does a DoH
 * (JSON format) A-record lookup for `sni` over that tunnel. Never touches
 * `sni` itself — only asks Cloudflare's own resolver what it looks like from
 * inside the proxy's network. `log` is called for every small step so the
 * caller can show it live instead of a silent multi-second wait. */
async function discoverViaProxy(
  proxy: DiscoveryProxy,
  sni: string,
  log: (line: string) => void = () => {},
): Promise<DiscoveryDetail> {
  const label = `${proxy.ip}:${proxy.port}`
  const tag = `[${proxy.country} ${label}]`
  let plainSocket: Socket | undefined
  let tlsSocket: Socket | undefined
  try {
    log(`🔌 ${tag} در حال اتصال به پروکسی...`)
    plainSocket = connect({ hostname: proxy.ip, port: proxy.port })
    await withTimeout(plainSocket.opened, DISCOVERY_TIMEOUT_MS, 'اتصال به پروکسی زمان‌بر شد (timeout)')
    log(`✅ ${tag} اتصال TCP به پروکسی برقرار شد`)

    const rawWriter = plainSocket.writable.getWriter()
    const rawReader = plainSocket.readable.getReader()
    const packet = new Uint8Array(9)
    packet[0] = 0x04
    packet[1] = 0x01
    packet[2] = (DOH_PORT >> 8) & 0xff
    packet[3] = DOH_PORT & 0xff
    packet.set(ipv4ToBytes(DOH_IP), 4)
    packet[8] = 0x00
    log(`📤 ${tag} ارسال SOCKS4 CONNECT به سمت ${DOH_IP}:${DOH_PORT} (DoH کلادفلر)`)
    await rawWriter.write(packet)
    const { value: connReply, done: connDone } = await withTimeout(
      rawReader.read(),
      DISCOVERY_TIMEOUT_MS,
      'پاسخ CONNECT از پروکسی دریافت نشد (timeout)',
    )
    rawWriter.releaseLock()
    rawReader.releaseLock()
    if (connDone || !connReply || connReply.length < 2 || connReply[1] !== 0x5a) {
      log(`❌ ${tag} SOCKS4 CONNECT رد شد`)
      return { proxy: label, country: proxy.country, success: false, candidates: [], error: 'SOCKS4 CONNECT رد شد' }
    }
    log(`✅ ${tag} SOCKS4 CONNECT پذیرفته شد — تونل به DoH باز شد`)

    tlsSocket = plainSocket.startTls({ expectedServerHostname: DOH_SNI })
    const writer = tlsSocket.writable.getWriter()
    const reader = tlsSocket.readable.getReader()
    try {
      log(`🔐 ${tag} در حال TLS handshake با ${DOH_SNI}...`)
      const path = `/dns-query?name=${encodeURIComponent(sni)}&type=A`
      const req = `GET ${path} HTTP/1.1\r\nHost: ${DOH_SNI}\r\nAccept: application/dns-json\r\nConnection: close\r\n\r\n`
      log(`📨 ${tag} ارسال کوئری DoH برای دامنه‌ی ${sni}`)
      await writer.write(new TextEncoder().encode(req))

      let raw = ''
      const decoder = new TextDecoder()
      for (;;) {
        const { value, done } = await withTimeout(reader.read(), DISCOVERY_TIMEOUT_MS, 'پاسخ DoH دریافت نشد (timeout)')
        if (done) break
        if (value) raw += decoder.decode(value, { stream: true })
        if (raw.length > 20000) break // safety cap
      }
      const candidates = parseDohJsonAnswers(raw)
      if (candidates.length > 0) {
        log(`📥 ${tag} پاسخ DoH دریافت شد — ${candidates.length} آی‌پی کاندید: ${candidates.join(', ')}`)
      } else {
        log(`⚠️ ${tag} پاسخ DoH خالی بود یا هیچ آی‌پی‌ای نداشت`)
      }
      return { proxy: label, country: proxy.country, success: candidates.length > 0, candidates }
    } finally {
      writer.releaseLock()
      reader.releaseLock()
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`❌ ${tag} خطا: ${msg}`)
    return {
      proxy: label,
      country: proxy.country,
      success: false,
      candidates: [],
      error: msg,
    }
  } finally {
    await closeQuietly(tlsSocket)
    await closeQuietly(plainSocket)
  }
}

/** Full two-stage run: discover candidates through every proxy of `country`
 * (or all countries), then validate every unique candidate directly with
 * sniHandshake — never through the proxy. `log` receives every granular step
 * from both stages, in the order they actually happen. */
export async function discoverAndValidate(
  country: string,
  sni: string,
  log: (line: string) => void = () => {},
): Promise<{ results: ScanResult[]; details: DiscoveryDetail[] }> {
  const proxies = proxiesForCountry(country)
  log(`🚀 مرحله ۱ شروع شد — کشف از طریق ${proxies.length} پروکسی (${country})`)
  const details = await mapWithConcurrency(proxies, DISCOVERY_CONCURRENCY, (p) => discoverViaProxy(p, sni, log))

  const candidateCountry = new Map<string, string>()
  for (const d of details) {
    for (const ip of d.candidates) {
      if (!candidateCountry.has(ip)) candidateCountry.set(ip, d.country)
    }
  }
  const candidates = Array.from(candidateCountry.keys())
  log(`🏁 مرحله ۱ تمام شد — ${candidates.length} کاندید یکتا جمع‌آوری شد`)
  if (candidates.length === 0) {
    log('⏹️ چون کاندیدی پیدا نشد، مرحله ۲ (اعتبارسنجی) اجرا نمی‌شود')
    return { results: [], details }
  }

  // Stage 2: validate directly, no proxy — this is what decides "healthy".
  log(`🚀 مرحله ۲ شروع شد — اعتبارسنجی مستقیم ${candidates.length} کاندید (بدون پروکسی) با SNI=${sni}`)
  const validated = await mapWithConcurrency(candidates, SCAN_CONCURRENCY, async (ip) => {
    log(`🧪 در حال اعتبارسنجی مستقیم ${ip} ...`)
    const r = await sniHandshake(ip, SNI_PORTS[0]!, sni)
    if (r.success) {
      log(`✅ ${ip} سالم است (${r.ping} ms)`)
    } else {
      log(`❌ ${ip} ناموفق: ${r.error ?? 'نامشخص'}`)
    }
    return { ...r, country: candidateCountry.get(ip) ?? null }
  })
  log('🏁 مرحله ۲ تمام شد')
  return { results: sortResults(validated), details }
}
