// NOTE: indexPage() (the public marketing landing page) is intentionally kept
// but no longer routed at "/" — see requirement #7. It's still reachable at
// "/landing" below for forks that want it back as the default root.
import { errorPage, indexPage, subscriptionPage } from '../pages/index.ts'
import { setupPage, loginPage, dashboardPage } from '../pages/admin.ts'
import { generateSubscription, buildUserSubscription, buildSubscriptionText } from '../services/subscription.ts'
import { processWebSocket } from '../network/websocket.ts'
import { handleDohRequest } from '../network/doh.ts'
import { splitAndFilter } from '../utils/array.ts'
import { handleAdminApi } from '../api/admin.ts'
import { handleTelegramUpdate } from '../telegram/bot.ts'
import {
  hasAdminPassword,
  getUserByUuid,
  getAllSettings,
  checkAndIncrementQuota,
  getQuotaStatus,
  getPoolRotation,
  getSetting,
  setSetting,
  getOrCreateWorkerSyncSecret,
  getLivePoolConfigOverrides,
  upsertSyncedUser,
  deleteSyncedUser,
  getBestCleanIp,
  getAutoCleanIps,
  getApprovedCleanIps,
  getConfigSlotSettings,
  listDnsRules,
  runCleanIpDiscovery,
} from '../db/queries.ts'
import { requireAdmin } from '../auth/session.ts'
import { runScheduledMaintenance } from '../cron/tasks.ts'

import type { Env } from './types.ts'

const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000 // hourly, same cadence as the old cron trigger

// Clean-IP discovery used to only run once per hourly maintenance pass (see
// maybeRunMaintenance below), 10 IPs at a time out of 60+ candidates — a
// full re-verification cycle took most of a day, so a range that got newly
// blocked by an ISP could keep being served as "clean" for hours. Running it
// on its own much shorter cycle means the whole candidate list gets
// re-checked roughly every hour instead, which is what actually fixes
// "sometimes the IP doesn't ping" for a country doing fast-moving IP-based
// blocking. Kept fully separate from maybeRunMaintenance (own timestamp key,
// own guard) so a slow/failed discovery pass never delays quota/expiry
// processing and vice versa.
const CLEAN_IP_SCAN_INTERVAL_MS = 10 * 60 * 1000 // every 10 minutes

/**
 * Runs trial/pro expiry + volume-quota + 80%-warning maintenance without a
 * Cloudflare cron trigger at all (see the note in wrangler.toml for why —
 * the account-wide 5-cron-trigger limit was breaking deploys on the
 * multi-worker pool setup). Instead, it self-schedules: every request checks
 * a `last_maintenance_run` timestamp in D1, and if more than an hour has
 * passed, kicks the job off in the background (ctx.waitUntil — never blocks
 * the response) and immediately stamps the timestamp so concurrent requests
 * don't all trigger it at once. Every step inside runScheduledMaintenance is
 * idempotent, so an occasional double-run from a race is harmless.
 */
function maybeRunMaintenance(env: Env, ctx: ExecutionContext, domain: string): void {
  if (!env.DB) return
  ctx.waitUntil(
    (async () => {
      try {
        const lastRunStr = await getSetting(env, 'last_maintenance_run')
        const lastRun = parseFloat(lastRunStr) || 0
        if (Date.now() - lastRun < MAINTENANCE_INTERVAL_MS) return
        await setSetting(env, 'last_maintenance_run', String(Date.now()))
        await runScheduledMaintenance(env, domain)
      } catch (err) {
        console.error('maybeRunMaintenance failed:', err)
      }
    })(),
  )
}

/** Same self-scheduling pattern as maybeRunMaintenance, but on its own much
 * shorter interval and limited to clean-IP discovery — see
 * CLEAN_IP_SCAN_INTERVAL_MS above for why this needs to run independently. */
function maybeRunCleanIpScan(env: Env, ctx: ExecutionContext, domain: string): void {
  if (!env.DB) return
  ctx.waitUntil(
    (async () => {
      try {
        const lastRunStr = await getSetting(env, 'last_clean_ip_scan')
        const lastRun = parseFloat(lastRunStr) || 0
        if (Date.now() - lastRun < CLEAN_IP_SCAN_INTERVAL_MS) return
        await setSetting(env, 'last_clean_ip_scan', String(Date.now()))
        await runCleanIpDiscovery(env, domain)
      } catch (err) {
        console.error('maybeRunCleanIpScan failed:', err)
      }
    })(),
  )
}

/**
 * Main request handler for the BNDMAX VPN application
 * Handles both HTTP requests and WebSocket upgrade requests
 */
export async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const earlyUrl = new URL(request.url)
    maybeRunMaintenance(env, ctx, earlyUrl.hostname)
    maybeRunCleanIpScan(env, ctx, earlyUrl.hostname)

    const upgradeHeader = request.headers.get('Upgrade')

    // Requirement #3: self-imposed daily request cap + kill switch.
    // Every request this Worker handles counts toward the daily quota —
    // Cloudflare bills every invocation, not just the WebSocket proxy
    // tunnel (see the long comment on checkAndIncrementQuota in
    // db/queries.ts for why counting only WS upgrades badly undercounted
    // real usage). The admin dashboard itself is NEVER blocked by a pause,
    // auto or manual, so the admin can always get in to resume the service
    // even while everything else is paused.
    //
    // Bug fixed here: this used to *synchronously await* a D1 read+write on
    // the shared `settings` row for every single request, including every
    // AJAX call the admin dashboard fires (it loads ~10 endpoints in
    // parallel, and the "continuous IP test" loop hits this once per
    // second). D1 serializes/queues concurrent writes to the same row, so a
    // burst of parallel requests could make this call slow enough to throw
    // (or just add real latency) — and because it ran *before* routing, a
    // failure here took the whole request down (including totally unrelated
    // admin-panel reads), which is what could make dashboard sections look
    // like they "never finish loading" with no visible error. The counter
    // write is still best-effort and still counts every request, but it now
    // runs in the background (ctx.waitUntil) and can never fail the actual
    // response — the pause/resume state itself is read separately with a
    // cheap, read-only lookup (getQuotaStatus) that doesn't write anything.
    let quotaPaused = false
    if (env.DB) {
      try {
        quotaPaused = (await getQuotaStatus(env)).paused
      } catch (err) {
        console.error('getQuotaStatus failed (treating as not paused):', err)
      }
      ctx.waitUntil(
        checkAndIncrementQuota(env).catch((err) => console.error('checkAndIncrementQuota failed:', err)),
      )
    }

    // Handle WebSocket upgrade requests (the actual VLESS proxy tunnel).
    // This is one of the two places a pause is actually enforced (the other
    // is the /sub + per-user subscription fetch below) — both are "using a
    // config"; DNS/Telegram/admin traffic is still counted above but never
    // blocked, so the rest of the panel keeps working while paused.
    if (upgradeHeader && upgradeHeader === 'websocket') {
      if (quotaPaused) {
        return new Response('سرویس موقتاً متوقف شده است. لطفاً بعداً تلاش کنید.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
      return processWebSocket(request, env, ctx)
    }

    const url = earlyUrl

    // ---------- Root ----------
    // Requirement #7: the public marketing page (indexPage) stays in the
    // codebase but is disabled — the admin login/dashboard is served at "/"
    // instead, exactly like "/admin". If you fork this and want the public
    // page back at "/", just change this block to `return await indexPage()`.
    if (url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/admin/') {
      const setupDone = await hasAdminPassword(env)
      if (!setupDone) return setupPage()
      const authed = await requireAdmin(request, env)
      if (!authed) return loginPage()
      return dashboardPage()
    }

    // Kept for forks that want the original public landing page back.
    if (url.pathname === '/landing') {
      return await indexPage()
    }
    if (url.pathname === '/admin/login') {
      const setupDone = await hasAdminPassword(env)
      if (!setupDone) return setupPage()
      return loginPage()
    }
    if (url.pathname.startsWith('/api/admin/')) {
      // Own try/catch (rather than letting an error fall through to the
      // outer one below): the outer catch returns errorPage(), an HTML
      // page. The dashboard's fetch helper always expects JSON back from
      // /api/admin/*, so an HTML error response there gets parsed as {}
      // instead of a real error — every table on the page then silently
      // stays on "در حال بارگذاری…" forever with no toast, because the
      // failure was never actually surfaced to the UI. Returning a proper
      // JSON error here (still logged to `wrangler tail` either way) means
      // a genuine backend problem — e.g. a D1 migration that wasn't run
      // yet, so a newer column doesn't exist — shows up as a visible error
      // toast instead of a silent, indefinite loading state.
      try {
        return await handleAdminApi(request, env, url)
      } catch (err) {
        console.error('Admin API error:', err)
        return new Response(
          JSON.stringify({ error: err instanceof Error ? err.message : 'خطای داخلی سرور' }),
          { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
        )
      }
    }

    // ---------- Worker-native DNS-over-HTTPS (Private DNS / DoH feature) ----------
    // Unlike DoT (port 853, requires the standalone dot-server/ VPS below),
    // DoH runs over plain HTTPS, so this Worker can answer it directly —
    // no extra infrastructure needed for any client that supports a custom
    // DoH URL (browsers, DoH-capable apps, curl --doh-url). Same routing
    // rules and same `dns_rules` D1 table as the DoT server; see
    // src/network/doh.ts and docs/private-dns-fa.md.
    if (url.pathname === '/dns-query' && (request.method === 'GET' || request.method === 'POST' || request.method === 'OPTIONS')) {
      return handleDohRequest(request, env)
    }

    // ---------- Public DNS routing list (Private DNS / DoT feature) ----------
    // Deliberately unauthenticated + CORS-open: this is the list the
    // standalone DoT server (dot-server/, run on separate infra — Workers
    // can't host a DNS-over-TLS listener on port 853) polls to decide which
    // domains/IPs/ranges get answered with a Cloudflare "clean" IP versus
    // resolved direct. It's meant to be shared publicly, not per-user.
    if (url.pathname === '/api/dns-rules' && request.method === 'GET') {
      if (!env.DB) return new Response(JSON.stringify({ rules: [], cleanIp: null }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
      const [rules, cleanIp] = await Promise.all([listDnsRules(env), getBestCleanIp(env)])
      return new Response(JSON.stringify({ rules, cleanIp }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' },
      })
    }

    // ---------- Telegram webhook ----------
    if (url.pathname === '/api/tg/webhook' && request.method === 'POST') {
      const update = await request.json().catch(() => null)
      if (update) ctx.waitUntil(handleTelegramUpdate(env, request, update))
      return new Response('ok', { status: 200 })
    }

    // ---------- Worker-to-worker sync (simple multi-account method) ----------
    // Authenticated by a shared secret header instead of the admin session
    // cookie, so another account's dashboard can call these directly. See
    // src/services/worker-sync.ts for the caller side.
    if (url.pathname.startsWith('/api/pool/') && request.method === 'POST' && env.DB) {
      const providedSecret = request.headers.get('X-Worker-Sync-Secret') || ''
      const ourSecret = await getOrCreateWorkerSyncSecret(env)
      const authorized = providedSecret.length > 0 && providedSecret === ourSecret
      if (!authorized) {
        return new Response(JSON.stringify({ ok: false, error: 'رمز اتصال ورکر اشتباه است' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.pathname === '/api/pool/ping') {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (url.pathname === '/api/pool/sync-user') {
        const body = await request.json().catch(() => null)
        if (!body?.user?.uuid) return new Response(JSON.stringify({ ok: false, error: 'user نامعتبر' }), { status: 400 })
        await upsertSyncedUser(env, body.user)
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (url.pathname === '/api/pool/remove-user') {
        const body = await request.json().catch(() => null)
        if (!body?.uuid) return new Response(JSON.stringify({ ok: false, error: 'uuid نامعتبر' }), { status: 400 })
        await deleteSyncedUser(env, body.uuid)
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({ ok: false, error: 'not found' }), { status: 404 })
    }

    // ---------- Subscription routes ----------
    if (url.pathname === '/sub') {
      if (quotaPaused) {
        return new Response('سرویس موقتاً متوقف شده است. لطفاً بعداً تلاش کنید.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
      return await subscriptionPage(env, request)
    }

    // Owner (env.UUID) subscription-by-path, kept for backward compatibility
    const ownerUuids = splitAndFilter(env.UUID, ',')
    for (const uuid of ownerUuids) {
      if (url.pathname.includes(uuid)) {
        return new Response(generateSubscription(uuid, url), {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    }

    // Managed (trial/pro) users, delivered via Telegram bot with a personal link
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const uuidLike = pathSegments.find((seg) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg),
    )
    if (uuidLike && env.DB) {
      const user = await getUserByUuid(env, uuidLike)
      if (user) {
        if (user.status !== 'active') {
          return new Response('این اشتراک منقضی یا غیرفعال شده است.', {
            status: 403,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }
        if (quotaPaused) {
          return new Response('سرویس موقتاً متوقف شده است. لطفاً بعداً تلاش کنید.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }
        // Each managed user gets a named config; active 'pro' users get 5
        // distinct configs, spread across the backend worker pool if one is
        // configured (requirements #2 and #4).
        const settings = await getAllSettings(env)
        const { activeHosts, pool } = await getPoolRotation(env)
        // Requirements #1/#2 (multi-account reliability + fast extraction):
        // for 'pro' users whose configs actually point at another account's
        // worker, re-sync + live-fetch that worker's OWN real config for
        // this uuid right now (see getLivePoolConfigOverrides in
        // db/queries.ts) instead of trusting that a past background sync
        // succeeded. Bounded by an overall cap so one slow/unreachable pool
        // account can never stall this user's subscription page past a few
        // seconds — on timeout we just fall back to the old local
        // construction (buildUserSubscription handles a missing override
        // gracefully), never blocking or failing the whole response.
        const poolLinkOverrides =
          user.type === 'pro' && activeHosts.length
            ? await Promise.race([
                getLivePoolConfigOverrides(pool, user),
                new Promise<Record<string, string>>((resolve) => setTimeout(() => resolve({}), 9000)),
              ])
            : {}
        // Clean-IP override: OFF by default (auto_clean_ip_enabled = '0'),
        // exactly like before this feature existed — every config's connect
        // address (`add=`) is simply the worker's own host. When the admin
        // turns the "🌐 آی‌پی‌های سالم" toggle ON from the dashboard, two
        // sources feed the 5 pro config slots (see buildUserSubscription):
        //  - getAutoCleanIps: the 2 best auto-discovered healthy IPs, added
        //    unconditionally, same as the feature behaved before the
        //    approval step existed.
        //  - getApprovedCleanIps: up to 3 IPs the admin tested and approved
        //    from the dashboard themselves.
        // Any slot with nothing available falls back to the worker's own
        // host, exactly like configs looked before this feature existed.
        const [autoCleanIps, selectedCleanIps, slotEnabled] = await Promise.all([
          getAutoCleanIps(env, 2),
          getApprovedCleanIps(env, 3),
          getConfigSlotSettings(env),
        ])
        const entries = buildUserSubscription(user, url, {
          brandName: settings.brand_name,
          adminUsername: settings.telegram_admin_username,
          poolHosts: activeHosts,
          poolLinkOverrides,
          proConfigName: settings.pro_config_name,
          trialConfigName: settings.trial_config_name,
          autoCleanIps,
          selectedCleanIps,
          slotEnabled,
        })

        // Requirement #2: v2rayNG / NekoBox / Hiddify / v2Box all read this
        // standard header (defined by the "subscription-userinfo" convention
        // most VLESS/V2Ray subscription servers follow) to show remaining
        // volume + expiry date right in the client's server list — it was
        // previously never sent, so clients had no way to display it at all.
        // upload is always 0 here since this project only tracks combined
        // usage; `total` is omitted entirely for unlimited (0 = no cap)
        // users, which every client treats as "unlimited" instead of "0 left".
        const usedBytes = Math.round((user.volume_used_mb || 0) * 1024 * 1024)
        const totalBytes = user.volume_limit_mb > 0 ? Math.round(user.volume_limit_mb * 1024 * 1024) : undefined
        const expireTs = user.expires_at ? Math.floor(user.expires_at / 1000) : undefined
        const userInfoParts = [`upload=0`, `download=${usedBytes}`]
        if (totalBytes !== undefined) userInfoParts.push(`total=${totalBytes}`)
        if (expireTs !== undefined) userInfoParts.push(`expire=${expireTs}`)

        return new Response(buildSubscriptionText(entries), {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            // Requirement #3: hint every subscription-aware client (v2rayN,
            // NekoBox, Shadowrocket, Hiddify, ...) to re-fetch this URL every
            // 12 hours on its own, so pool-rotation / config changes reach
            // the user automatically without them re-importing anything.
            'Profile-Update-Interval': '12',
            'Subscription-Userinfo': userInfoParts.join('; '),
            'Content-Disposition': `attachment; filename="${user.uuid}.txt"`,
          },
        })
      }
    }

    return new Response('یافت نشد', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (err) {
    console.error('Handler error:', err)
    return await errorPage()
  }
}
