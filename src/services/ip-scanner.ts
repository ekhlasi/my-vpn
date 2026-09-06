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
