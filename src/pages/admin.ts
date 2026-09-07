import { baseStyles } from './index'

function shell(title: string, body: string, extraStyle = ''): string {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>${baseStyles}</style>
  <style>${extraStyle}</style>
</head>
<body>
<div class="bg-watermark" aria-hidden="true"></div>
${body}
<script>
(function() {
  const stored = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', stored);
})();
</script>
</body>
</html>`
}

const authFormStyle = `
  body { display:flex; overflow-x:hidden; }
  .auth-wrap {
    position: relative; z-index: 1; overflow: hidden;
    min-height: 100vh; width:100%; display: flex; align-items: center; justify-content: center; padding: 1.25rem;
    background:
      radial-gradient(circle at 15% 15%, color-mix(in srgb, var(--primary) 10%, transparent) 0%, transparent 45%),
      radial-gradient(circle at 85% 85%, color-mix(in srgb, var(--accent) 10%, transparent) 0%, transparent 45%);
  }

  /* ---------- Sine-wave frame around the login screen (decorative, CSS-only) ---------- */
  .auth-wave {
    position: absolute; z-index: 0; pointer-events: none;
    background-repeat: repeat; opacity: 0.5;
  }
  .auth-wave.top, .auth-wave.bottom {
    left: 0; width: 100%; height: 120px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='120' viewBox='0 0 300 120'%3E%3Cpath d='M0 60 C 37.5 10, 75 110, 112.5 60 S 187.5 10, 225 60 S 300 110, 300 60' stroke='%236556e8' stroke-width='3' fill='none'/%3E%3C/svg%3E");
    background-size: 300px 120px;
  }
  .auth-wave.top { top: 0; animation: authWaveDrift 16s linear infinite; }
  .auth-wave.bottom {
    bottom: 0; transform: scaleY(-1); animation: authWaveDrift 20s linear infinite reverse;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='120' viewBox='0 0 300 120'%3E%3Cpath d='M0 60 C 37.5 10, 75 110, 112.5 60 S 187.5 10, 225 60 S 300 110, 300 60' stroke='%2306b6d4' stroke-width='3' fill='none'/%3E%3C/svg%3E");
  }
  .auth-wave.left, .auth-wave.right {
    top: 0; height: 100%; width: 120px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='300' viewBox='0 0 120 300'%3E%3Cpath d='M60 0 C 10 37.5, 110 75, 60 112.5 S 10 187.5, 60 225 S 110 300, 60 300' stroke='%2314b88a' stroke-width='3' fill='none'/%3E%3C/svg%3E");
    background-size: 120px 300px;
  }
  .auth-wave.left { left: 0; animation: authWaveDriftV 18s linear infinite; }
  .auth-wave.right { right: 0; animation: authWaveDriftV 22s linear infinite reverse; }
  @keyframes authWaveDrift { from { background-position-x: 0; } to { background-position-x: 300px; } }
  @keyframes authWaveDriftV { from { background-position-y: 0; } to { background-position-y: 300px; } }
  @media (prefers-reduced-motion: reduce) {
    .auth-wave.top, .auth-wave.bottom, .auth-wave.left, .auth-wave.right { animation: none; }
  }
  @media (max-width: 640px) {
    .auth-wave.left, .auth-wave.right { display: none; }
  }

  .auth-card {
    position: relative; z-index: 1; width: 100%; max-width: 380px; padding: 2.25rem 2rem;
    backdrop-filter: blur(var(--glass-blur)) saturate(150%);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(150%);
  }
  .auth-brand { text-align:center; font-size:2.1rem; margin-bottom:0.75rem; }
  .auth-card h1 { text-align:center; font-size:1.4rem; font-weight:800; margin-bottom: 0.3rem; }
  .auth-card p.sub { text-align:center; color:var(--text-muted); margin-bottom:1.6rem; font-size:0.87rem; }
  .auth-card .field { max-width: none; }
  .msg { font-size:0.85rem; text-align:center; margin-top:0.9rem; min-height:1.2rem; font-weight:500; }
  .msg.error { color: var(--error); }
  .msg.ok { color: var(--accent); }
`

export function setupPage(): Response {
  const body = `
  <div class="auth-wrap">
    <div class="auth-wave top" aria-hidden="true"></div>
    <div class="auth-wave bottom" aria-hidden="true"></div>
    <div class="auth-wave left" aria-hidden="true"></div>
    <div class="auth-wave right" aria-hidden="true"></div>
    <div class="glass auth-card">
      <div class="auth-brand">🛡️</div>
      <h1>راه‌اندازی داشبورد</h1>
      <p class="sub">این اولین اجرای داشبورد است. یک رمز عبور مدیریتی تعیین کنید.</p>
      <form id="f">
        <div class="field"><label>رمز عبور جدید</label><input type="password" id="p1" required minlength="6" /></div>
        <div class="field"><label>تکرار رمز عبور</label><input type="password" id="p2" required minlength="6" /></div>
        <button class="btn" type="submit" style="width:100%; justify-content:center;">ایجاد و ورود</button>
      </form>
      <div class="msg" id="msg"></div>
    </div>
  </div>
  <script>
    document.getElementById('f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('msg');
      const p1 = document.getElementById('p1').value;
      const p2 = document.getElementById('p2').value;
      if (p1 !== p2) { msg.textContent = 'رمزها یکسان نیستند'; msg.className = 'msg error'; return; }
      const res = await fetch('/api/admin/setup', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password: p1 }) });
      const data = await res.json();
      if (res.ok) { location.href = '/admin'; }
      else { msg.textContent = data.error || 'خطا رخ داد'; msg.className = 'msg error'; }
    });
  </script>`
  return new Response(shell('راه‌اندازی داشبورد', body, authFormStyle), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export function loginPage(error?: string): Response {
  const body = `
  <div class="auth-wrap">
    <div class="auth-wave top" aria-hidden="true"></div>
    <div class="auth-wave bottom" aria-hidden="true"></div>
    <div class="auth-wave left" aria-hidden="true"></div>
    <div class="auth-wave right" aria-hidden="true"></div>
    <div class="glass auth-card">
      <div class="auth-brand">🔐</div>
      <h1>ورود به داشبورد</h1>
      <p class="sub">BNDMAX VPN &middot; پنل مدیریت</p>
      <form id="f">
        <div class="field"><label>رمز عبور</label><input type="password" id="p" required /></div>
        <button class="btn" type="submit" style="width:100%; justify-content:center;">ورود</button>
      </form>
      <div class="msg ${error ? 'error' : ''}" id="msg">${error ?? ''}</div>
    </div>
  </div>
  <script>
    document.getElementById('f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('msg');
      const p = document.getElementById('p').value;
      const res = await fetch('/api/admin/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password: p }) });
      const data = await res.json();
      if (res.ok) { location.href = '/admin'; }
      else { msg.textContent = data.error || 'رمز اشتباه است'; msg.className = 'msg error'; }
    });
  </script>`
  return new Response(shell('ورود به داشبورد', body, authFormStyle), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

const dashboardStyle = `
  body { display:flex; }

  .dash-shell { position:relative; z-index:1; display:flex; width:100%; min-height:100vh; align-items:flex-start; }

  /* ---------- Sidebar navigation (doubles as .tabs) ---------- */
  .tabs {
    flex: 0 0 var(--sidebar-w);
    width: var(--sidebar-w);
    min-height: 100vh;
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1.1rem 0.9rem;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: blur(var(--glass-blur)) saturate(140%);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(140%);
    border-inline-end: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
    z-index: 50;
  }
  .sidebar-brand {
    display:flex; align-items:center; gap:0.55rem;
    font-weight:800; font-size:1.05rem;
    padding: 0.5rem 0.7rem 1rem;
    margin-bottom: 0.6rem;
  }
  .tabs .zigzag-divider { margin-bottom: 0.7rem; border-radius: 4px; }
  .tab-btn {
    position: relative; overflow:hidden; isolation:isolate;
    display:flex; align-items:center; gap:0.65rem;
    padding:0.7rem 0.85rem; border-radius:var(--radius-sm); border:1px solid transparent; cursor:pointer;
    background: transparent; color: var(--text-muted);
    font-family:inherit; font-weight:600; font-size:0.86rem; text-align:start;
    transition: background var(--transition), color var(--transition), border-color var(--transition), transform var(--transition);
  }
  .tab-btn:hover { background: var(--surface-2); color: var(--text); border-color: var(--border); transform: translateX(-2px); }
  [dir="rtl"] .tab-btn:hover { transform: translateX(2px); }
  .tab-btn.active {
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    color:#fff; border-color: color-mix(in srgb, #fff 25%, var(--primary) 75%);
    box-shadow: 0 4px 14px rgba(101, 86, 232, 0.38), inset 0 1px 0 rgba(255,255,255,0.3);
    backdrop-filter: blur(6px);
  }
  .tab-btn.active::before {
    content:''; position:absolute; inset:0;
    background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.4) 48%, transparent 66%);
    transform: translateX(-130%); animation: tabShine 3.2s ease-in-out infinite;
  }
  @keyframes tabShine { 0%, 60% { transform: translateX(-130%); } 100% { transform: translateX(130%); } }
  @media (prefers-reduced-motion: reduce) { .tab-btn.active::before { animation:none; } }

  .dash-main { flex: 1 1 0; min-width: 0; padding: 1.6rem 1.75rem 3rem; }

  .dash-header {
    display:flex; justify-content:space-between; align-items:center;
    margin-bottom:0.5rem; flex-wrap:wrap; gap:0.8rem;
    position: sticky; top: 0; z-index: 10;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    padding: 0.6rem 0 1rem;
  }
  .dash-header h1 { font-size:1.35rem; font-weight:800; }
  .dash-header-wave { position: sticky; top: calc(var(--header-h) - 20px); z-index: 9; margin-bottom: 1.4rem; }

  /* Mobile top bar / hamburger (hidden on desktop) */
  .mobile-topbar { display:none; }
  .sidebar-backdrop { display:none; }

  .tab-panel { display:none; }
  .tab-panel.active { display:block; animation: fadeIn 0.35s ease; }

  .stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:1rem; margin-bottom:1.5rem; }
  .stat-card { text-align:center; padding:1.3rem 0.5rem; }
  .stat-card .num { font-size:1.85rem; font-weight:800; color:var(--primary); }
  .stat-card .lbl { font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem; }

  h3 { font-size: 1rem; font-weight:700; margin-bottom: 0.75rem; letter-spacing: 0.01em; }

  /* Consistent card spacing — replaces the old per-section inline margins */
  .tab-panel .glass { margin-bottom: 1.2rem; }
  .tab-panel .glass:last-child { margin-bottom: 0; }

  /* Consistent muted helper/description text — replaces ad-hoc opacity values
     (which looked inconsistent, especially in dark mode) with the theme's
     actual muted-text color. */
  .help-text { color: var(--text-muted); font-size: 0.83rem; line-height: 1.7; margin-bottom: 0.9rem; }
  .help-text.help-text-mt { margin-top: 0.6rem; margin-bottom: 0; }
  .help-text code { font-size: 0.85em; }

  table { width:100%; border-collapse:collapse; font-size:0.85rem; }
  th, td { padding:0.65rem 0.6rem; text-align:right; border-bottom:1px solid var(--border); white-space:nowrap; }
  th { color:var(--text-muted); font-weight:700; font-size:0.78rem; }
  tbody tr:hover { background: var(--surface-2); }

  .pill { display:inline-block; padding:0.22rem 0.65rem; border-radius:30px; font-size:0.72rem; font-weight:700; }
  .pill.active { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent-dark); }
  .pill.expired { background: color-mix(in srgb, var(--error) 15%, transparent); color: var(--error); }
  .pill.disabled { background: color-mix(in srgb, var(--text-muted) 18%, transparent); color: var(--text-muted); }
  .pill.pro { background: color-mix(in srgb, var(--warning) 20%, transparent); color: #b3760a; }
  .pill.trial { background: color-mix(in srgb, var(--primary) 15%, transparent); color: var(--primary); }
  .pill.neutral { background: color-mix(in srgb, var(--text-muted) 18%, transparent); color: var(--text-muted); }
  [data-theme="dark"] .pill.pro { color: #f0b429; }

  .table-wrap { overflow-x:auto; border-radius: var(--radius-sm); }
  .row-actions { display:flex; gap:0.35rem; flex-wrap:wrap; }
  .row-actions button {
    border:none; border-radius:8px; padding:0.35rem 0.7rem; font-size:0.72rem; cursor:pointer;
    background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); font-family:inherit; font-weight:600;
    transition: filter var(--transition), transform var(--transition);
    white-space:nowrap;
  }
  .row-actions button:active { transform: scale(0.96); }
  @media (max-width: 480px) {
    .row-actions button { padding:0.45rem 0.8rem; font-size:0.76rem; }
  }
  .row-actions button:hover { filter: brightness(0.95); }
  .row-actions button.danger { background: color-mix(in srgb, var(--error) 12%, transparent); color: var(--error); }

  form.settings-form .field { max-width:440px; }
  form.settings-form summary { color: var(--primary); font-weight:600; font-size:0.85rem; cursor:pointer; }

  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  @media (max-width:600px){ .grid2 { grid-template-columns:1fr; } }

  /* ---------- Clean-IP discovery scanner ---------- */
  .scanner-card { margin-top:1.2rem; border-top: 3px solid var(--secondary); }
  textarea.scanner-textarea {
    width:100%; min-height:120px; resize:vertical;
    font-family:'SFMono-Regular', Consolas, monospace; font-size:0.82rem;
    padding:0.65rem 0.8rem; border-radius:var(--radius-sm); border:1.5px solid var(--border);
    background:var(--surface-2); color:var(--text); transition:border-color var(--transition);
  }
  textarea.scanner-textarea:focus { outline:none; border-color:var(--secondary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--secondary) 16%, transparent); }
  .port-check-row { display:flex; flex-wrap:wrap; gap:0.5rem; }
  .port-check-row label {
    display:inline-flex; align-items:center; gap:0.35rem;
    padding:0.35rem 0.7rem; border-radius:30px; border:1.5px solid var(--border);
    font-size:0.78rem; cursor:pointer; user-select:none; background:var(--surface-2);
    transition: border-color var(--transition), background var(--transition);
  }
  .port-check-row label:has(input:checked) { border-color:var(--secondary); background: color-mix(in srgb, var(--secondary) 12%, transparent); }
  .port-check-row input { width:auto; margin:0; accent-color:var(--secondary); }
  .scan-progress { margin-top:0.8rem; }
  .scan-progress-bar { height:8px; border-radius:8px; background:var(--surface-2); border:1px solid var(--border); overflow:hidden; }
  .scan-progress-fill {
    height:100%; width:0%; border-radius:8px;
    background: linear-gradient(90deg, var(--secondary), var(--accent));
    transition: width 0.25s ease;
  }
  #scanResultsTable tbody tr:hover, #candidateResultsTable tbody tr:hover { background: var(--surface-2); }
  #scanResultsTable td, #candidateResultsTable td { white-space: nowrap; }

  .toast {
    position:fixed; top:20px; left:20px; background:var(--accent); color:#fff;
    padding:0.7rem 1.3rem; border-radius:var(--radius-sm); box-shadow:var(--shadow-lg);
    transform:translateX(-130%); transition:transform .35s ease; z-index:1000; font-size:0.85rem; font-weight:600;
  }
  .toast.show { transform:translateX(0); }
  .toast.error { background: var(--error); }

  .badge-link { font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem; }

  /* ---------- Per-user usage cell (table) — compact text + tiered mini-bar ---------- */
  .usage-cell { display:flex; flex-direction:column; gap:0.3rem; min-width:120px; }
  .usage-text { font-size:0.78rem; white-space:nowrap; font-family:'SFMono-Regular', Consolas, monospace; }
  .usage-text .usage-pct { color:var(--text-muted); font-family:inherit; font-size:0.72rem; }
  .usage-unlimited { color: var(--text-muted); font-weight:600; }
  .usage-bar-wrap { width:100%; height:5px; border-radius:6px; background:var(--surface-2); border:1px solid var(--border); overflow:hidden; }
  .usage-bar-fill {
    height:100%; border-radius:6px; width:0%;
    background: linear-gradient(90deg, var(--accent) 0%, var(--accent-dark) 100%);
    transition: width .4s ease, background .4s ease;
  }
  .usage-bar-fill.warn { background: linear-gradient(90deg, var(--warning) 0%, #d18f06 100%); }
  .usage-bar-fill.danger { background: linear-gradient(90deg, var(--error) 0%, #b23434 100%); }

  /* ---------- Info callout (replaces plain <p class="help-text"> walls of text) ---------- */
  .info-box {
    display:flex; gap:0.7rem; align-items:flex-start;
    background: color-mix(in srgb, var(--secondary) 8%, var(--surface-2));
    border: 1px solid color-mix(in srgb, var(--secondary) 25%, var(--border));
    border-inline-start: 3px solid var(--secondary);
    border-radius: var(--radius-sm);
    padding: 0.85rem 1rem;
    margin-bottom: 1rem;
  }
  .info-box .info-icon { font-size:1.05rem; line-height:1.5; flex-shrink:0; }
  .info-box p { color: var(--text-muted); font-size:0.83rem; line-height:1.7; margin:0; }
  .info-box p + p { margin-top:0.5rem; }
  .info-box code { font-size:0.85em; }

  .section-title {
    display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;
    margin-bottom: 0.9rem;
  }
  .section-title h3 { margin-bottom:0; }
  .section-title .pill { font-weight:600; }

  /* ---------- Type badges (Private DNS rule kind, etc.) ---------- */
  .dns-badge {
    display:inline-flex; align-items:center; gap:0.3rem;
    padding:0.2rem 0.6rem; border-radius:30px; font-size:0.72rem; font-weight:700;
    white-space:nowrap;
  }
  .dns-badge.domain { background: color-mix(in srgb, var(--primary) 15%, transparent); color: var(--primary); }
  .dns-badge.ip { background: color-mix(in srgb, var(--secondary) 15%, transparent); color: var(--secondary); }
  .dns-badge.cidr { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent-dark); }
  [data-theme="dark"] .dns-badge.cidr { color: var(--accent); }

  .field-icon-group { position:relative; }
  .field-icon-group .field-icon {
    position:absolute; inset-inline-start:0.85rem; top:50%; transform:translateY(-50%);
    font-size:0.95rem; opacity:0.7; pointer-events:none;
  }
  .field-icon-group input, .field-icon-group select { padding-inline-start:2.3rem; }

  /* ---------- User configs viewer ---------- */
  .config-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:1rem; }
  .config-card { display:flex; flex-direction:column; gap:0.7rem; border-top: 3px solid var(--primary); }
  .config-card-header { display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap; }
  .config-card-name { font-weight:700; font-size:0.92rem; }
  .config-card-meta { display:flex; gap:0.9rem; flex-wrap:wrap; font-size:0.74rem; color:var(--text-muted); font-family:'SFMono-Regular', Consolas, monospace; }

  .config-link-box {
    display:flex; align-items:center; gap:0.5rem;
    background: var(--surface-2); border:1.5px solid var(--border); border-radius:var(--radius-sm);
    padding:0.55rem 0.7rem;
  }
  .config-link-box .config-link-text {
    flex:1 1 0; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    background:none; border:none; padding:0; font-size:0.72rem; direction:ltr; text-align:left;
  }
  .config-link-box .btn { flex-shrink:0; padding:0.4rem 0.75rem; font-size:0.74rem; }

  .ping-badge {
    display:inline-flex; align-items:center; gap:0.3rem;
    padding:0.25rem 0.65rem; border-radius:30px; font-size:0.74rem; font-weight:700;
    background: color-mix(in srgb, var(--text-muted) 15%, transparent); color: var(--text-muted);
    transition: background var(--transition), color var(--transition);
  }
  .ping-badge.testing { background: color-mix(in srgb, var(--secondary) 15%, transparent); color: var(--secondary); animation: pingPulse 1.1s ease-in-out infinite; }
  .ping-badge.good { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent-dark); }
  [data-theme="dark"] .ping-badge.good { color: var(--accent); }
  .ping-badge.warn { background: color-mix(in srgb, var(--warning) 20%, transparent); color: #b3760a; }
  [data-theme="dark"] .ping-badge.warn { color: #f0b429; }
  .ping-badge.bad { background: color-mix(in srgb, var(--error) 16%, transparent); color: var(--error); }
  @keyframes pingPulse { 0%, 100% { opacity:1; } 50% { opacity:0.55; } }
  @media (prefers-reduced-motion: reduce) { .ping-badge.testing { animation:none; } }
  .quota-bar-wrap {
    position: relative; width:100%; height:11px; border-radius:10px;
    background: var(--surface-2); border: 1px solid var(--border); overflow:hidden;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.08);
    animation: quotaGlowPulse 4.2s ease-in-out infinite alternate;
  }
  @keyframes quotaGlowPulse {
    0% { box-shadow: inset 0 1px 3px rgba(0,0,0,0.08), 0 0 0 rgba(255,196,64,0); }
    50% { box-shadow: inset 0 1px 3px rgba(0,0,0,0.08), 0 0 9px rgba(255,196,64,0.32); }
    100% { box-shadow: inset 0 1px 3px rgba(0,0,0,0.08), 0 0 0 rgba(255,196,64,0); }
  }
  .quota-bar {
    position: relative; height:100%; border-radius:10px; width:0%;
    background: linear-gradient(90deg, var(--accent) 0%, var(--accent-dark) 100%);
    transition: width .6s cubic-bezier(.4,0,.2,1), background .6s ease;
    overflow: hidden;
  }
  .quota-bar.warn { background: linear-gradient(90deg, var(--warning) 0%, #d18f06 100%); }
  .quota-bar.danger { background: linear-gradient(90deg, var(--error) 0%, #b23434 100%); }
  /* Golden light that sweeps end-to-end and back across the whole bar,
     independent of the fill color/width — a slim "premium" accent that
     signals the bar is live without taking any extra vertical space. */
  .quota-bar-wrap::after {
    content:''; position:absolute; inset:0 auto 0 0; pointer-events:none;
    width: 46%; height:100%;
    background: linear-gradient(90deg, transparent 0%, transparent 30%, rgba(255,210,90,0.75) 50%, transparent 70%, transparent 100%);
    animation: quotaGoldSweep 4.2s ease-in-out infinite alternate;
  }
  @keyframes quotaGoldSweep {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(215%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .quota-bar-wrap::after { animation: none; display:none; }
    .quota-bar-wrap { animation: none; }
  }

  /* ---------- Responsive: collapse sidebar into a top bar on small screens ---------- */
  @media (max-width: 900px) {
    body { display:block; }
    .dash-shell { display:block; }
    .mobile-topbar {
      position: relative;
      display:flex; align-items:center; justify-content:space-between;
      position: sticky; top:0; z-index: 60;
      background: color-mix(in srgb, var(--surface) 90%, transparent);
      backdrop-filter: blur(var(--glass-blur)) saturate(150%);
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(150%);
      padding: 0.85rem 1rem; box-shadow: var(--shadow-sm);
    }
    .mobile-topbar .sidebar-brand { padding:0; margin:0; border:none; }
    .mobile-topbar .wave-divider { position:absolute; left:0; right:0; bottom:-4px; }
    .hamburger-btn {
      width:38px; height:38px; border-radius:var(--radius-sm); border:1px solid var(--border);
      background: var(--surface-2); font-size:1.1rem; cursor:pointer;
    }
    .tabs {
      position: fixed; inset-inline-start: 0; top: 0; height:100vh;
      transform: translateX(-102%);
      transition: transform var(--transition);
      box-shadow: var(--shadow-lg);
      /* Must sit above .sidebar-backdrop (z-index 55) and .mobile-topbar
         (z-index 60) — otherwise, once open, the backdrop's blurred overlay
         covers the sidebar itself and its buttons look frosted and can't be
         clicked/tapped. */
      z-index: 65;
    }
    [dir="rtl"] .tabs { transform: translateX(102%); }
    .tabs.open { transform: translateX(0); }
    .sidebar-backdrop {
      display:none; position: fixed; inset:0; background: rgba(10,10,20,0.45);
      z-index: 55; backdrop-filter: blur(2px);
    }
    .sidebar-backdrop.show { display:block; }
    .dash-main { padding: 1.1rem 1rem 2.5rem; }
    .dash-header { position: static; padding: 0 0 1rem; }
  }

  @media (max-width: 480px) {
    .stat-grid { grid-template-columns: repeat(2, 1fr); }
    th, td { font-size:0.78rem; padding:0.5rem 0.4rem; }
  }
`

export function dashboardPage(): Response {
  const body = `
  <div class="dash-shell">
    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

    <nav class="tabs" id="sidebarNav">
      <div class="sidebar-brand">🛡️ <span>BNDMAX VPN</span></div>
      <div class="zigzag-divider" aria-hidden="true"></div>
      <button class="tab-btn active" data-tab="overview">📊 نمای کلی</button>
      <button class="tab-btn" data-tab="users">👥 کاربران</button>
      <button class="tab-btn" data-tab="userconfigs">🔗 کانفیگ‌های کاربر</button>
      <button class="tab-btn" data-tab="botusers">📇 لیست ورودی‌های ربات</button>
      <button class="tab-btn" data-tab="trial">🎁 تنظیمات تست</button>
      <button class="tab-btn" data-tab="quota">⚡ محدودیت مصرف کلادفلر</button>
      <button class="tab-btn" data-tab="pool">🖧 پنل‌ها / اکانت‌های کلادفلر</button>
      <button class="tab-btn" data-tab="dns">🌐 Private DNS</button>
      <button class="tab-btn" data-tab="telegram">🤖 ربات تلگرام</button>
      <button class="tab-btn" data-tab="security">🔒 امنیت</button>
    </nav>

    <div class="dash-main">
    <div class="mobile-topbar">
      <div class="sidebar-brand">🛡️ <span>BNDMAX</span></div>
      <button class="hamburger-btn" id="hamburgerBtn" aria-label="باز کردن منو">☰</button>
      <div class="wave-divider" aria-hidden="true"></div>
    </div>

    <div class="dash-header">
      <h1>پنل مدیریت</h1>
      <button class="btn" id="logoutBtn" style="background:var(--error);">خروج</button>
    </div>
    <div class="wave-divider dash-header-wave" aria-hidden="true"></div>

    <div class="tab-panel active" id="tab-overview">
      <div class="stat-grid" id="statGrid"><div class="glass stat-card">…</div></div>

      <div class="glass">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-bottom:0.6rem;">
          <h3>⚡ مصرف امروز از سقف روزانه کلادفلر</h3>
          <span class="pill" id="serviceStatusPill">…</span>
        </div>
        <div class="quota-bar-wrap"><div class="quota-bar" id="quotaBarFill" style="width:0%"></div></div>
        <p class="help-text help-text-mt" id="quotaText">در حال بارگذاری…</p>
        <div style="display:flex; gap:0.6rem; flex-wrap:wrap; margin-top:0.6rem;">
          <button class="btn" style="background:var(--error);" id="pauseBtn">⏸️ قطع موقت همه اتصالات</button>
          <button class="btn" id="resumeBtn">▶️ وصل کردن مجدد</button>
        </div>
      </div>

      <div class="glass">
        <h3>آدرس‌های ثابت مالک (env.UUID)</h3>
        <p class="help-text">این‌ها همیشه فعال و بدون محدودیت حجم/زمان هستند و از متغیر UUID در wrangler.toml خوانده می‌شوند.</p>
      </div>
    </div>

    <div class="tab-panel" id="tab-users">
      <div class="glass">
        <h3>➕ افزودن اشتراک پرو</h3>
        <form class="settings-form" id="proForm">
          <div class="grid2">
            <div class="field"><label>آیدی عددی تلگرام کاربر</label><input type="text" id="proTelegramId" placeholder="مثلاً 123456789" required /></div>
            <div class="field"><label>نام/یوزرنیم (اختیاری)</label><input type="text" id="proTelegramName" placeholder="@username" /></div>
            <div class="field"><label>مدت اعتبار (روز)</label><input type="number" id="proDays" value="30" min="1" required /></div>
            <div class="field"><label>حجم (گیگابایت)</label><input type="number" id="proVolume" value="50" min="1" required /></div>
          </div>
          <button class="btn btn-vip" type="submit">🎖️ ساخت اشتراک پرو</button>
        </form>
        <p class="help-text help-text-mt">در صورت ثبت آیدی تلگرام، لینک اشتراک به‌صورت خودکار برای کاربر ارسال می‌شود (اگر ربات متصل باشد).</p>
      </div>

      <div class="glass table-wrap">
        <div class="section-title" style="margin-bottom:0.9rem;">
          <h3 style="margin-bottom:0;">لیست کاربران</h3>
          <button class="btn btn-sub" type="button" id="refreshUsersBtn" style="padding:0.4rem 0.85rem; font-size:0.78rem;">🔄 بروزرسانی</button>
          <span class="help-text" id="usersUpdatedAt" style="margin:0; font-size:0.72rem;"></span>
        </div>
        <table id="usersTable">
          <thead><tr><th>UUID</th><th>تلگرام</th><th>نوع</th><th>وضعیت</th><th>مصرف</th><th>انقضا</th><th>عملیات</th></tr></thead>
          <tbody><tr><td colspan="7">در حال بارگذاری…</td></tr></tbody>
        </table>
      </div>
    </div>

    <div class="tab-panel" id="tab-userconfigs">
      <div class="glass">
        <div class="section-title">
          <h3>🔗 مشاهده و کپی کانفیگ‌های یک کاربر</h3>
        </div>
        <div class="info-box">
          <span class="info-icon">💡</span>
          <div>
            <p>
              دقیقاً همان کانفیگ‌هایی که به کاربر داده می‌شود (یا با لینک اشتراک خودکار برایش ارسال شده) اینجا نمایش
              داده می‌شود — قابل کپی مستقیم برای پیست در اپلیکیشن، به‌همراه یک تست پینگ واقعی (هندشیک TLS به همان
              آدرس/پورت/SNI دقیق آن کانفیگ) برای هرکدام.
            </p>
          </div>
        </div>
        <div class="grid2" style="align-items:end;">
          <div class="field field-icon-group" style="max-width:none;">
            <label>کاربر</label>
            <span class="field-icon">🔍</span>
            <input list="userConfigsDatalist" id="userConfigsUuidInput" placeholder="جستجوی نام/آیدی تلگرام یا چسباندن UUID" autocomplete="off" />
            <datalist id="userConfigsDatalist"></datalist>
          </div>
          <div class="field" style="max-width:none; margin-bottom:1rem;">
            <button class="btn" type="button" id="loadUserConfigsBtn" style="width:100%; justify-content:center;">📂 نمایش کانفیگ‌ها</button>
          </div>
        </div>
        <p class="help-text help-text-mt" id="userConfigsStatusText"></p>
      </div>

      <div id="userConfigsResult"></div>
    </div>

    <div class="tab-panel" id="tab-botusers">
      <div class="glass table-wrap">
        <h3>📇 هر کسی که وارد ربات شده</h3>
        <p class="help-text">این لیست شامل همه کسانی است که تاکنون به ربات پیام داده‌اند، حتی اگر هنوز اشتراکی دریافت نکرده باشند.</p>
        <table id="botUsersTable">
          <thead><tr><th>آیدی تلگرام</th><th>نام/یوزرنیم</th><th>اولین بازدید</th><th>آخرین بازدید</th><th>تعداد پیام</th></tr></thead>
          <tbody><tr><td colspan="5">در حال بارگذاری…</td></tr></tbody>
        </table>
      </div>
    </div>

    <div class="tab-panel" id="tab-trial">
      <div class="glass">
        <h3>تنظیمات اشتراک تست</h3>
        <form class="settings-form" id="trialForm">
          <div class="field"><label>مدت اعتبار تست (ساعت)</label><input type="number" id="trialDuration" min="1" required /></div>
          <div class="field"><label>حجم تست (مگابایت)</label><input type="number" id="trialVolume" min="1" required /></div>
          <div class="field"><label>فاصله زمانی مجاز برای دریافت تست بعدی (ساعت)</label><input type="number" id="trialCooldown" min="1" required /></div>
          <div class="field"><label>اعلان مصرف هر چند مگابایت به کاربر ارسال شود</label><input type="number" id="notifyStepMb" min="1" required /></div>
          <button class="btn" type="submit">💾 ذخیره تنظیمات</button>
        </form>
      </div>

      <div class="glass">
        <h3>🏷️ نام کانفیگ‌های پرو و تست</h3>
        <p class="help-text">
          این متن همان نامی است که داخل اپلیکیشن کاربر (بعد از # در لینک ساب) نمایش داده می‌شود. می‌توانید از
          <code>{brand}</code> (نام برند)، <code>{admin}</code> (یوزرنیم ادمین)، <code>{n}</code> (شماره کانفیگ، فقط برای پرو)،
          و <code>{flag}</code>/<code>{country}</code> (پرچم و نام کشوری که در تب «پنل‌ها» برای اکانت مقصد آن کانفیگ
          مشخص کرده‌اید، فقط برای پرو — اگر اکانتی کشور نداشته باشد این دو خالی می‌مانند) استفاده کنید. توجه: این برچسب
          کاملاً دستی و نمایشی است؛ فقط برای اکانتی که واقعاً می‌دانید متعلق به آن کشور است کشور تنظیم کنید.
        </p>
        <form class="settings-form" id="configNameForm">
          <div class="field"><label>نام کانفیگ اشتراک پرو</label><input type="text" id="proConfigName" placeholder="{flag} {brand} VIP |{country}{n} | @{admin}" /></div>
          <div class="field"><label>نام کانفیگ اشتراک تست</label><input type="text" id="trialConfigName" placeholder="{brand} | خرید: @{admin}" /></div>
          <button class="btn" type="submit">💾 ذخیره نام‌ها</button>
        </form>
      </div>

      <div class="glass">
        <h3>🎁 جایزه ماهانه ویژه VIP</h3>
        <p class="help-text">
          کاربران VIP فعال می‌توانند هر ۳۰ روز یک‌بار از داخل ربات (دکمه «🎁 جایزه ویژه VIP») این لینک را به‌عنوان جایزه دریافت کنند. یک لینک ساب/کانفیگ معتبر ۱ ماهه اینجا وارد کنید.
        </p>
        <form class="settings-form" id="wikiGiftForm">
          <div class="field"><label>لینک جایزه (ساب یا کانفیگ)</label><input type="text" id="wikiGiftLink" placeholder="https://..." /></div>
          <button class="btn" type="submit">💾 ذخیره لینک جایزه</button>
        </form>
      </div>
    </div>

    <div class="tab-panel" id="tab-quota">
      <div class="glass">
        <h3>⚡ سقف درخواست روزانه</h3>
        <p class="help-text">
          پلن رایگان کلادفلر ورکرز روزانه ۱۰۰٬۰۰۰ درخواست را مجاز می‌داند. برای اینکه هیچ‌وقت به این سقف نخورید و ورکر مسدود/محدود نشود،
          یک سقف خودمانی (کمتر از سقف واقعی) تعیین کنید؛ با رسیدن مصرف به این سقف، در صورت فعال بودن «توقف خودکار»، اتصالات جدید تا روز بعد یا تا وصل مجدد دستی، پذیرفته نمی‌شوند.
        </p>
        <form class="settings-form" id="quotaForm">
          <div class="field"><label>سقف روزانه (تعداد اتصال/درخواست)</label><input type="number" id="dailyLimit" min="100" required /></div>
          <div class="field" style="display:flex; align-items:center; gap:0.5rem;">
            <input type="checkbox" id="autoPause" style="width:auto;" />
            <label for="autoPause" style="margin:0;">توقف خودکار سرویس هنگام رسیدن به سقف</label>
          </div>
          <button class="btn" type="submit">💾 ذخیره تنظیمات</button>
        </form>
      </div>
    </div>

    <div class="tab-panel" id="tab-pool">
      <div class="glass">
        <h3>🔑 رمز اتصال این ورکر</h3>
        <p class="help-text">
          این رمز مخصوص همین ورکر است. آن را همراه آدرس همین ورکر به هر اکانت دیگری بدهید تا بتواند این ورکر را به لیست
          اکانت‌های خودش اضافه کند و کانفیگ/کاربرانش را با آن هماهنگ کند — بدون نیاز به هیچ توکن یا شناسه‌ای از کلادفلر.
        </p>
        <div class="grid2">
          <div class="field"><label>آدرس همین ورکر</label><input type="text" id="mySyncUrl" readonly /></div>
          <div class="field"><label>رمز اتصال</label><input type="text" id="mySyncSecret" readonly /></div>
        </div>
        <button class="btn" id="copySyncBtn" type="button">📋 کپی آدرس + رمز</button>
        <button class="btn" id="regenSyncBtn" type="button" style="margin-inline-start:0.5rem;">🔄 تولید رمز جدید</button>
      </div>

      <div class="glass">
        <h3>🖧 پنل‌ها / اکانت‌های کلادفلر</h3>
        <p class="help-text">
          برای افزودن یک ورکر روی اکانت کلادفلر دیگر: فقط «آدرس ورکر» و همان «رمز اتصال ورکر» را که از تب پنل‌های همان
          ورکر (بخش بالا، روی آن اکانت) کپی کرده‌اید وارد کنید — نیازی به توکن کلادفلر، Account ID یا Database ID نیست.
          کاربران VIP و بررسی سلامت به‌صورت خودکار و مستقیم بین دو ورکر رد و بدل می‌شود.
        </p>
        <form class="settings-form" id="poolAddForm" style="margin-bottom:1rem;">
          <div class="grid2">
            <div class="field"><label>آدرس ورکر *</label><input type="text" id="poolUrl" placeholder="my-worker-2.username.workers.dev" required /></div>
            <div class="field"><label>برچسب (اختیاری)</label><input type="text" id="poolLabel" placeholder="اکانت ۲" /></div>
          </div>
          <div class="grid2">
            <div class="field">
              <label>کشور برای نام‌گذاری کانفیگ (اختیاری)</label>
              <select id="poolCountry">
                <option value="">-</option>
                <option value="DE">🇩🇪 آلمان</option>
                <option value="TR">🇹🇷 ترکیه</option>
                <option value="AE">🇦🇪 امارات</option>
                <option value="FR">🇫🇷 فرانسه</option>
                <option value="IT">🇮🇹 ایتالیا</option>
                <option value="RU">🇷🇺 روسیه</option>
                <option value="NL">🇳🇱 هلند</option>
                <option value="GB">🇬🇧 انگلستان</option>
                <option value="US">🇺🇸 آمریکا</option>
              </select>
            </div>
            <div class="field"><label>رمز اتصال ورکر مقصد (از تب پنل‌های همان ورکر)</label><input type="text" id="poolSyncSecret" placeholder="رمز اتصال آن ورکر را اینجا بچسبانید" /></div>
          </div>
          <details style="margin:0.6rem 0;">
            <summary>روش قدیمی‌تر با توکن کلادفلر (اختیاری، فقط اگر رمز اتصال بالا را ندارید)</summary>
            <div class="grid2" style="margin-top:0.6rem;">
              <div class="field"><label>Cloudflare Account ID</label><input type="text" id="poolAccountId" placeholder="Account ID" /></div>
              <div class="field"><label>Cloudflare API Token</label><input type="password" id="poolApiToken" placeholder="API Token" /></div>
              <div class="field"><label>D1 Database ID (همان اکانت)</label><input type="text" id="poolDatabaseId" placeholder="Database ID" /></div>
              <div class="field"><label>نام اسکریپت ورکر روی آن اکانت</label><input type="text" id="poolScriptName" placeholder="my-vpn" /></div>
            </div>
          </details>
          <button class="btn" type="submit">➕ افزودن اکانت</button>
        </form>

        <div class="grid2" style="margin-bottom:1rem;">
          <div class="field"><label>اندازه هر گروه فعال (batch size)</label><input type="number" id="poolBatchSize" min="1" required /></div>
          <div class="field"><label>مدت استراحت هر گروه (روز)</label><input type="number" id="poolRestDays" min="1" required /></div>
        </div>
        <button class="btn" id="poolSettingsSaveBtn" type="button">💾 ذخیره تنظیمات چرخش</button>
        <button class="btn" id="poolCheckAllBtn" type="button" style="margin-inline-start:0.5rem;">🩺 بررسی سلامت همه اکانت‌ها</button>
        <button class="btn" id="poolResyncAllBtn" type="button" style="margin-inline-start:0.5rem;">🔄 Sync دستی همه کاربران به همه اکانت‌ها</button>
        <p class="help-text help-text-mt">
          هر وقت اکانت جدیدی اضافه می‌کنید یا رمز/توکن یک اکانت را بعداً وارد می‌کنید، این کار به‌صورت خودکار انجام می‌شود؛
          این دکمه فقط برای اطمینان یا رفع مشکل sync ناقص است.
        </p>

        <div class="table-wrap" style="margin-top:1.2rem;">
          <table id="poolTable">
            <thead><tr><th>کشور</th><th>آدرس</th><th>برچسب</th><th>سلامت اکانت</th><th>وضعیت چرخش</th><th>فعال/غیرفعال</th><th>عملیات</th></tr></thead>
            <tbody><tr><td colspan="7">در حال بارگذاری…</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="glass">
        <h3>🌐 آی‌پی‌های سالم</h3>
        <p class="help-text">
          آی‌پی و پورتی که خودتان برای کاربران‌تان سالم/باز بودنش را تأیید کرده‌اید همین‌جا وارد کنید (یا با اسکنر
          پایین همین باکس بسنجید). وقتی گزینه‌ی زیر را فعال کنید، آدرس اتصال (add) کانفیگ‌ها به‌جای دامنه‌ی خود ورکر،
          یکی از همین آی‌پی:پورت‌ها (به‌صورت تصادفی از بین لیست) می‌شود؛ فیلدهای host/sni همچنان روی دامنه‌ی واقعی
          ورکر باقی می‌مانند، پس مسیریابی خراب نمی‌شود.
        </p>
        <div class="field" style="display:flex; align-items:center; gap:0.5rem; max-width:none;">
          <input type="checkbox" id="autoCleanIp" style="width:auto;" />
          <label for="autoCleanIp" style="margin:0;">استفاده از لیست آی‌پی سالم به‌جای دامنه در کانفیگ‌ها</label>
        </div>
        <button class="btn" id="autoCleanIpSaveBtn" type="button" style="margin-top:0.6rem;">💾 ذخیره</button>

        <form class="settings-form" id="cleanIpForm" style="margin-top:1rem;">
          <div class="grid2">
            <div class="field"><label>آی‌پی</label><input type="text" id="cleanIpValue" required placeholder="104.16.1.1" /></div>
            <div class="field"><label>پورت</label><input type="number" id="cleanIpPort" min="1" max="65535" value="443" required /></div>
          </div>
          <div class="grid2">
            <div class="field">
              <label>کشور (اختیاری)</label>
              <select id="cleanIpCountry">
                <option value="">-</option>
                <option value="DE">🇩🇪 آلمان</option>
                <option value="TR">🇹🇷 ترکیه</option>
                <option value="AE">🇦🇪 امارات</option>
                <option value="FR">🇫🇷 فرانسه</option>
                <option value="IT">🇮🇹 ایتالیا</option>
                <option value="RU">🇷🇺 روسیه</option>
                <option value="NL">🇳🇱 هلند</option>
                <option value="GB">🇬🇧 انگلستان</option>
                <option value="US">🇺🇸 آمریکا</option>
              </select>
            </div>
            <div class="field"><label>یادداشت (اختیاری)</label><input type="text" id="cleanIpNote" placeholder="مثلاً: تست‌شده روی همراه‌اول" /></div>
          </div>
          <button class="btn" type="submit">➕ افزودن به لیست</button>
        </form>
        <p class="help-text help-text-mt">
          برای سروری که خودتان اجاره می‌کنید و آدرسش مرتب عوض می‌شود (مثلاً اجاره‌ی هفتگی)، به‌جای وارد کردن دستی هر بار
          از اینجا، می‌توانید مستقیماً <code>src/data/rented-clean-ips.ts</code> را ویرایش و دوباره دیپلوی کنید — سریع‌تر
          و بدون نیاز به باز کردن داشبورد است. ردیف‌های آن فایل با برچسب «فایل» در جدول زیر مشخص می‌شوند.
        </p>
        <div class="table-wrap" style="margin-top:1rem;">
          <table id="cleanIpsTable">
            <thead><tr><th>کشور</th><th>آی‌پی</th><th>پورت</th><th>یادداشت</th><th>منبع</th><th>افزوده‌شده</th><th>عملیات</th></tr></thead>
            <tbody><tr><td colspan="7">در حال بارگذاری…</td></tr></tbody>
          </table>
        </div>

        <div style="margin-top:1.4rem; padding-top:1.2rem; border-top:1px solid var(--border);">
          <h3>🔍 اسکنر خودکار سلامت</h3>
          <p class="help-text">
            هر دو ردیف بالا (دستی + فایل <code>rented-clean-ips.ts</code>) را همین‌جا، مستقیماً از داخل همین ورکر تست
            کنید — دیگر نیازی به اجرای اسکنر جداگانه روی سیستم شخصی یا وارد کردن توکن کلادفلر نیست؛ دامنه/SNI مورد نیاز
            برای حالت TLS به‌صورت خودکار همان دامنه‌ای است که همین لحظه با آن به داشبورد وصل شده‌اید.
          </p>
          <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
            <button class="btn" id="scanSocks4Btn" type="button">🧦 اسکن SOCKS4 (سلامت پروکسی)</button>
            <button class="btn" id="scanSniBtn" type="button">🔒 اسکن TLS/SNI (پیشنهادی)</button>
          </div>
          <p class="help-text help-text-mt" id="scanStatusText"></p>
          <div class="table-wrap" style="margin-top:0.8rem;">
            <table id="scanResultsTable" style="display:none;">
              <thead><tr><th>کشور</th><th>آی‌پی</th><th>پورت</th><th>وضعیت</th><th>پینگ</th><th>خطا</th><th>عملیات</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="glass scanner-card">
        <h3>🛰️ Radar — کشف خودکار آی‌پی تمیز (بدون نیاز به لیست)</h3>
        <p class="help-text">
          برخلاف باکس پایین که باید از قبل یک لیست آی‌پی از جایی (کانال تلگرام و…) داشته باشید، Radar کاملاً خودکار
          است: چند ده آی‌پی از <b>رنج‌های رسمی Cloudflare</b> را مستقیماً از <b>همین مرورگر و همین شبکه‌ای که الان
          روی آن هستید</b> تست می‌کند (نه از سرور)، سریع‌ترین‌ها را انتخاب و برای تأیید نهایی (هندشیک واقعی TLS/SNI)
          به خود ورکر می‌فرستد. برای بهترین نتیجه، Radar را از روی گوشی/مودمی بزنید که کاربرانتان معمولاً با همان
          اپراتور/ISP وصل می‌شوند؛ نتیجه‌اش فقط برای همین شبکه معتبر است و هر چند روز یک‌بار بهتر است دوباره اجرا شود.
          مرحله‌ی پیش‌فیلتر مرورگر صددرصد دقیق نیست (محدودیت گواهی TLS در مرورگر)، برای همین نتیجه‌اش همیشه با یک
          هندشیک واقعی روی خود ورکر دوباره تأیید می‌شود.
        </p>
        <button class="btn" id="radarScanBtn" type="button">🛰️ اجرای Radar روی شبکه فعلی</button>
        <div class="scan-progress" id="radarProgressWrap" style="display:none;">
          <div class="scan-progress-bar"><div class="scan-progress-fill" id="radarProgressFill"></div></div>
        </div>
        <p class="help-text help-text-mt" id="radarStatusText"></p>
      </div>

      <div class="glass scanner-card">
        <h3>🔎 کشف آی‌پی تمیز جدید (دستی)</h3>
        <p class="help-text">
          یک یا چند آی‌پی/رنج کاندید (مثلاً از کانال/لیست‌های عمومی «آی‌پی تمیز فلان کشور») را در کادر زیر بچسبانید —
          هر خط یکی، به‌صورت <code>1.2.3.4</code> یا <code>1.2.3.4:443</code> یا <code>1.2.3.4,443,DE</code>؛
          به‌جای یک آی‌پی تکی می‌توانید یک <b>رنج CIDR</b> هم بدهید، مثلاً <code>1.2.3.0/24</code> یا
          <code>1.2.3.0/24,443,DE</code> — همه‌ی آی‌پی‌های آن رنج به‌طور خودکار باز می‌شوند و تک‌تک تست می‌شوند
          (حداکثر تا <code>/24</code>، یعنی ۲۵۶ آی‌پی در هر رنج؛ برای جلوگیری از timeout روی ورکر، رنج‌های
          بزرگ‌تر مثل <code>/16</code> پذیرفته نمی‌شوند — آن را به چند تکه‌ی <code>/24</code> تقسیم کنید).
          کشور و پورت هر خط اختیاری‌اند؛ اگر ننویسید از انتخاب‌های پایین کادر استفاده می‌شود. تست به‌صورت هندشیک
          واقعی TLS با SNI همین دامنه انجام می‌شود، دقیقاً مثل اسکنر بالا — هیچ آدرسی از جای دیگری گرفته نمی‌شود.
        </p>

        <div class="field" style="max-width:none;">
          <label>لیست آی‌پی‌ها یا رنج‌های کاندید (هر خط یکی)</label>
          <textarea id="candidateInput" class="scanner-textarea" rows="6" placeholder="104.16.1.1&#10;104.16.2.0/24&#10;104.16.3.1,8443,DE"></textarea>
        </div>

        <div class="grid2">
          <div class="field">
            <label>کشور پیش‌فرض (برای خط‌هایی که کشور ننوشته‌اند)</label>
            <select id="candidateCountry">
              <option value="">-</option>
              <option value="DE">🇩🇪 آلمان</option>
              <option value="TR">🇹🇷 ترکیه</option>
              <option value="AE">🇦🇪 امارات</option>
              <option value="AZ">🇦🇿 آذربایجان</option>
              <option value="FR">🇫🇷 فرانسه</option>
              <option value="IT">🇮🇹 ایتالیا</option>
              <option value="RU">🇷🇺 روسیه</option>
              <option value="NL">🇳🇱 هلند</option>
              <option value="GB">🇬🇧 انگلستان</option>
              <option value="US">🇺🇸 آمریکا</option>
            </select>
          </div>
          <div class="field">
            <label>پورت‌های سفارشی (اختیاری، جدا با ویرگول)</label>
            <input type="text" id="candidateCustomPorts" placeholder="مثلاً 443,2053,8443" />
          </div>
        </div>

        <div class="field" style="max-width:none;">
          <label>پورت‌های پیش‌فرض برای خط‌هایی که پورت ننوشته‌اند</label>
          <div class="port-check-row" id="candidatePortsRow"></div>
        </div>

        <button class="btn" id="scanCandidatesBtn" type="button">🚀 شروع اسکن و پیدا کردن آی‌پی سالم</button>
        <div class="scan-progress" id="candidateProgressWrap" style="display:none;">
          <div class="scan-progress-bar"><div class="scan-progress-fill" id="candidateProgressFill"></div></div>
        </div>
        <p class="help-text help-text-mt" id="candidateStatusText"></p>

        <div class="table-wrap" style="margin-top:0.8rem;">
          <table id="candidateResultsTable" style="display:none;">
            <thead><tr><th>کشور</th><th>آی‌پی</th><th>پورت</th><th>وضعیت</th><th>پینگ</th><th>خطا</th><th>عملیات</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <button class="btn btn-sub" id="addAllHealthyBtn" type="button" style="display:none; margin-top:0.8rem;">
          ➕ افزودن همه‌ی موارد سالم به لیست
        </button>
      </div>
    </div>

    <div class="tab-panel" id="tab-dns">
      <div class="glass">
        <div class="section-title">
          <h3>🌐 لیست عمومی Private DNS</h3>
          <span class="pill neutral" id="dnsRuleCountPill">…</span>
        </div>

        <div class="info-box">
          <span class="info-icon">📡</span>
          <div>
            <p>
              این لیست از طریق آدرس عمومی و بدون‌نیاز-به-ورود <code>/api/dns-rules</code> در اختیار سرور جدا (dot-server/) قرار می‌گیرد
              که Private DNS واقعی اندروید را اجرا می‌کند — روی خود این Worker نمی‌شود DNS-over-TLS (پورت 853) میزبانی کرد،
              Cloudflare Workers فقط HTTP/HTTPS جواب می‌دهد. برای دامنه‌ها/آی‌پی/رنج‌هایی که اینجا اضافه می‌کنید، آن سرور به‌جای
              آدرس واقعی، بهترین آی‌پی سالم کلادفلر (تب «پنل‌ها») را برمی‌گرداند؛ بقیه دامنه‌ها مستقیم resolve می‌شوند.
              راهنمای کامل نصب سرور و تنظیم Private DNS روی اندروید: <code>docs/private-dns-fa.md</code>.
            </p>
            <p>
              همچنین همین Worker یک آدرس <b>DoH</b> (بدون نیاز به VPS جدا) روی مسیر
              <code>/dns-query</code> ارائه می‌دهد که از همین لیست استفاده می‌کند — برای برنامه‌ها
              و مرورگرهایی که آدرس DoH سفارشی قبول می‌کنند (نه فیلد سیستمی Private DNS اندروید،
              که فقط DoT را قبول می‌کند).
            </p>
          </div>
        </div>

        <form class="settings-form" id="dnsRuleForm">
          <div class="grid2">
            <div class="field field-icon-group">
              <label>نوع</label>
              <span class="field-icon">🏷️</span>
              <select id="dnsRuleKind">
                <option value="domain">دامنه (مثلاً example.com یا *.example.com)</option>
                <option value="ip">آی‌پی تکی</option>
                <option value="cidr">رنج آی‌پی (CIDR، مثلاً 1.2.3.0/24)</option>
              </select>
            </div>
            <div class="field field-icon-group">
              <label>مقدار</label>
              <span class="field-icon">🔗</span>
              <input type="text" id="dnsRuleValue" required placeholder="example.com" />
            </div>
          </div>
          <div class="field field-icon-group">
            <label>یادداشت (اختیاری)</label>
            <span class="field-icon">📝</span>
            <input type="text" id="dnsRuleNote" placeholder="مثلاً: سایت فیلترشده X" />
          </div>
          <button class="btn" type="submit">➕ افزودن به لیست</button>
        </form>

        <div class="table-wrap" style="margin-top:1.2rem;">
          <table id="dnsRulesTable">
            <thead><tr><th>نوع</th><th>مقدار</th><th>یادداشت</th><th>افزوده‌شده</th><th>عملیات</th></tr></thead>
            <tbody><tr><td colspan="5">در حال بارگذاری…</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="tab-panel" id="tab-telegram">
      <div class="glass">
        <h3>اتصال ربات تلگرام</h3>
        <form class="settings-form" id="tgForm">
          <div class="field"><label>توکن ربات (از BotFather)</label><input type="text" id="tgToken" placeholder="123456:ABC-..." /></div>
          <div class="field"><label>آیدی عددی ادمین تلگرام</label><input type="text" id="tgAdminId" placeholder="مثلاً 123456789" /></div>
          <div class="field"><label>یوزرنیم ادمین (بدون @)</label><input type="text" id="tgAdminUsername" placeholder="vahidekhlasi" /></div>
          <div class="field"><label>یوزرنیم کانال اجباری (با @)</label><input type="text" id="requiredChannel" placeholder="@donatewirepubg" /></div>
          <div class="field"><label>لینک دعوت کانال</label><input type="text" id="requiredChannelUrl" placeholder="https://t.me/donatewirepubg" /></div>
          <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
            <button class="btn" type="submit">💾 ذخیره تنظیمات</button>
            <button class="btn btn-sub" type="button" id="setWebhookBtn">🔗 فعال‌سازی Webhook</button>
          </div>
        </form>
        <p class="badge-link">آیدی عددی خودت رو می‌تونی با پیام دادن به ربات @userinfobot در تلگرام پیدا کنی.</p>
        <p class="badge-link">⚠️ برای اینکه ربات بتواند عضویت کاربران در کانال را چک کند، باید ربات را به‌عنوان ادمین کانال اضافه کنید.</p>
      </div>
    </div>

    <div class="tab-panel" id="tab-security">
      <div class="glass">
        <h3>تغییر رمز عبور داشبورد</h3>
        <form class="settings-form" id="pwForm">
          <div class="field"><label>رمز عبور فعلی</label><input type="password" id="curPw" required /></div>
          <div class="field"><label>رمز عبور جدید</label><input type="password" id="newPw" required minlength="6" /></div>
          <button class="btn" type="submit">🔒 تغییر رمز</button>
        </form>
      </div>
    </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
  (function() {
    const toast = document.getElementById('toast');
    function showToast(msg, isErr) {
      toast.textContent = msg;
      toast.className = 'toast' + (isErr ? ' error' : '') + ' show';
      clearTimeout(toast._t);
      toast._t = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    const sidebarNav = document.getElementById('sidebarNav');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    function closeSidebar() {
      sidebarNav.classList.remove('open');
      sidebarBackdrop.classList.remove('show');
    }
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', () => {
        sidebarNav.classList.toggle('open');
        sidebarBackdrop.classList.toggle('show');
      });
    }
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        closeSidebar();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Data can go stale while a tab isn't visible (dashboard left open in a
        // background browser tab while usage keeps accumulating server-side) —
        // re-fetch the relevant section's numbers every time its tab is opened,
        // instead of only ever showing the one snapshot loaded at page-load.
        const tab = btn.dataset.tab;
        if (tab === 'overview') { Promise.resolve(loadOverview()).catch(() => {}); Promise.resolve(loadQuota()).catch(() => {}); }
        else if (tab === 'users') { Promise.resolve(loadUsers()).catch(() => {}); }
      });
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await fetch('/api/admin/logout', { method: 'POST' });
      location.href = '/admin/login';
    });

    async function api(path, opts) {
      const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
      if (res.status === 401) { location.href = '/admin/login'; throw new Error('unauthorized'); }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'خطا');
      return data;
    }

    function fmtMb(mb) {
      mb = Number(mb);
      if (!Number.isFinite(mb) || mb < 0) mb = 0;
      return mb >= 1024 ? (mb/1024).toFixed(2) + ' GB' : Math.round(mb) + ' MB';
    }
    function fmtDate(ts) { return ts ? new Date(ts).toLocaleString('fa-IR') : 'نامحدود'; }

    function usageCellHtml(u) {
      const used = Number(u.volume_used_mb) || 0;
      const limit = Number(u.volume_limit_mb) || 0;
      if (limit > 0) {
        const pct = Math.min(100, (used / limit) * 100);
        const tier = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';
        return (
          '<div class="usage-cell">' +
            '<div class="usage-text">' + fmtMb(used) + ' / ' + fmtMb(limit) + ' <span class="usage-pct">(' + pct.toFixed(0) + '٪)</span></div>' +
            '<div class="usage-bar-wrap"><div class="usage-bar-fill ' + tier + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
          '</div>'
        );
      }
      return '<div class="usage-cell"><div class="usage-text">' + fmtMb(used) + ' <span class="usage-unlimited">/ نامحدود</span></div></div>';
    }

    async function loadOverview() {
      const data = await api('/api/admin/stats');
      const grid = document.getElementById('statGrid');
      grid.innerHTML = [
        ['کل کاربران', data.total],
        ['فعال', data.active],
        ['تست', data.trial],
        ['پرو', data.pro],
        ['منقضی/غیرفعال', data.inactive],
        ['کل مصرف', fmtMb(data.totalUsageMb)],
      ].map(([lbl, num]) => '<div class="glass stat-card"><div class="num">' + num + '</div><div class="lbl">' + lbl + '</div></div>').join('');
    }

    let lastUsersList = [];
    async function loadUsers() {
      const data = await api('/api/admin/users');
      lastUsersList = data.users || [];
      populateUserConfigsDatalist(lastUsersList);
      const tbody = document.querySelector('#usersTable tbody');
      const updatedAt = document.getElementById('usersUpdatedAt');
      if (updatedAt) updatedAt.textContent = 'آخرین بروزرسانی: ' + new Date().toLocaleTimeString('fa-IR');
      if (!data.users.length) { tbody.innerHTML = '<tr><td colspan="7">کاربری ثبت نشده</td></tr>'; return; }
      tbody.innerHTML = data.users.map(u => {
        return '<tr>' +
          '<td style="font-family:monospace;font-size:0.7rem;">' + u.uuid.slice(0,8) + '…</td>' +
          '<td>' + (u.telegram_name || u.telegram_id || '-') + '</td>' +
          '<td><span class="pill ' + u.type + '">' + (u.type === 'pro' ? 'پرو' : 'تست') + '</span></td>' +
          '<td><span class="pill ' + u.status + '">' + (u.status === 'active' ? 'فعال' : u.status === 'expired' ? 'منقضی' : 'غیرفعال') + '</span></td>' +
          '<td>' + usageCellHtml(u) + '</td>' +
          '<td style="font-size:0.72rem;">' + fmtDate(u.expires_at) + '</td>' +
          '<td class="row-actions">' +
            '<button data-act="toggle" data-uuid="' + u.uuid + '" data-status="' + u.status + '">' + (u.status === 'active' ? 'غیرفعال' : 'فعال') + '</button>' +
            '<button data-act="extend" data-uuid="' + u.uuid + '">+۳۰ روز</button>' +
            '<button data-act="configs" data-uuid="' + u.uuid + '">🔗 کانفیگ‌ها</button>' +
            '<button class="danger" data-act="delete" data-uuid="' + u.uuid + '">حذف</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      tbody.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async () => {
          const act = btn.dataset.act, uuid = btn.dataset.uuid;
          try {
            if (act === 'toggle') {
              const next = btn.dataset.status === 'active' ? 'disabled' : 'active';
              await api('/api/admin/users/' + uuid, { method: 'PATCH', body: JSON.stringify({ status: next }) });
            } else if (act === 'extend') {
              await api('/api/admin/users/' + uuid + '/extend', { method: 'POST', body: JSON.stringify({ days: 30 }) });
            } else if (act === 'delete') {
              if (!confirm('حذف این کاربر قطعی است. ادامه می‌دهید؟')) return;
              await api('/api/admin/users/' + uuid, { method: 'DELETE' });
            } else if (act === 'configs') {
              document.querySelector('.tab-btn[data-tab="userconfigs"]').click();
              document.getElementById('userConfigsUuidInput').value = uuid;
              loadUserConfigs(uuid);
              return;
            }
            showToast('انجام شد');
            loadUsers(); loadOverview();
          } catch (e) { showToast(e.message, true); }
        });
      });
    }

    function populateUserConfigsDatalist(users) {
      const list = document.getElementById('userConfigsDatalist');
      if (!list) return;
      list.innerHTML = users.map(u =>
        '<option value="' + u.uuid + '" label="' + (u.telegram_name || u.telegram_id || u.uuid.slice(0,8)) + ' — ' + (u.type === 'pro' ? 'پرو' : 'تست') + '"></option>'
      ).join('');
    }

    async function loadUserConfigs(uuidInput) {
      const statusEl = document.getElementById('userConfigsStatusText');
      const resultEl = document.getElementById('userConfigsResult');
      const raw = (uuidInput || document.getElementById('userConfigsUuidInput').value || '').trim();
      if (!raw) { statusEl.textContent = 'یک کاربر را از لیست انتخاب کنید یا UUID او را بچسبانید.'; resultEl.innerHTML = ''; return; }
      // Allow typing a telegram name/id from the datalist label too — resolve back to its uuid.
      let uuid = raw;
      const byNameOrId = lastUsersList.find(u => String(u.telegram_name) === raw || String(u.telegram_id) === raw);
      if (byNameOrId) uuid = byNameOrId.uuid;
      statusEl.textContent = 'در حال بارگذاری…';
      resultEl.innerHTML = '';
      try {
        const data = await api('/api/admin/users/' + encodeURIComponent(uuid) + '/configs');
        statusEl.textContent = '';
        renderUserConfigs(data);
      } catch (e) {
        statusEl.textContent = '';
        showToast(e.message, true);
      }
    }

    function renderUserConfigs(data) {
      const resultEl = document.getElementById('userConfigsResult');
      const u = data.user;
      const header =
        '<div class="glass" style="margin-bottom:1.2rem;">' +
          '<div class="section-title">' +
            '<h3>' + (u.telegram_name || (u.uuid.slice(0,8) + '…')) + '</h3>' +
            '<span class="pill ' + u.type + '">' + (u.type === 'pro' ? 'پرو' : 'تست') + '</span>' +
            '<span class="pill ' + u.status + '">' + (u.status === 'active' ? 'فعال' : u.status === 'expired' ? 'منقضی' : 'غیرفعال') + '</span>' +
          '</div>' +
          '<div class="field field-icon-group" style="max-width:none; margin-bottom:0;">' +
            '<label>لینک اشتراک (Subscription) — همیشه بروز، همه کانفیگ‌ها داخل همین یک لینک</label>' +
            '<span class="field-icon">🔗</span>' +
            '<div class="config-link-box">' +
              '<code class="config-link-text">' + data.subscriptionUrl + '</code>' +
              '<button class="btn btn-sub" type="button" data-copy="' + encodeURIComponent(data.subscriptionUrl) + '">📋 کپی</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      const cards = data.entries.map((e, i) => {
        const id = 'cfg' + i;
        return (
          '<div class="glass config-card">' +
            '<div class="config-card-header">' +
              '<span class="config-card-name">' + e.name + '</span>' +
              '<span class="ping-badge idle" id="ping-' + id + '">⏱ تست‌نشده</span>' +
            '</div>' +
            '<div class="config-link-box">' +
              '<code class="config-link-text">' + e.link + '</code>' +
              '<button class="btn btn-sub" type="button" data-copy="' + encodeURIComponent(e.link) + '">📋 کپی</button>' +
            '</div>' +
            '<div class="config-card-meta">' +
              '<span>🖧 ' + e.address + ':' + e.port + '</span>' +
              '<span>🔒 SNI ' + e.sni + '</span>' +
            '</div>' +
            '<button class="btn ping-btn" type="button" data-ping-id="' + id + '" data-address="' + e.address + '" data-port="' + e.port + '" data-sni="' + e.sni + '">🛰️ تست پینگ</button>' +
          '</div>'
        );
      }).join('');

      resultEl.innerHTML = header + '<div class="config-grid">' + cards + '</div>';

      resultEl.querySelectorAll('[data-copy]').forEach(btn => {
        btn.addEventListener('click', () => {
          const text = decodeURIComponent(btn.dataset.copy);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => showToast('کپی شد')).catch(() => showToast('کپی نشد', true));
          } else {
            showToast('کپی خودکار پشتیبانی نمی‌شود؛ متن را دستی انتخاب کنید', true);
          }
        });
      });

      resultEl.querySelectorAll('.ping-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const badge = document.getElementById('ping-' + btn.dataset.pingId);
          badge.className = 'ping-badge testing';
          badge.textContent = '⏳ در حال تست…';
          btn.disabled = true;
          try {
            const pingData = await api('/api/admin/config-ping', { method: 'POST', body: JSON.stringify({
              address: btn.dataset.address, port: btn.dataset.port, sni: btn.dataset.sni,
            })});
            const r = pingData.result;
            if (r && r.success) {
              const cls = r.ping < 150 ? 'good' : r.ping < 400 ? 'warn' : 'bad';
              const icon = cls === 'good' ? '🟢' : cls === 'warn' ? '🟡' : '🔴';
              badge.className = 'ping-badge ' + cls;
              badge.textContent = icon + ' ' + r.ping + ' ms';
            } else {
              badge.className = 'ping-badge bad';
              badge.textContent = '🔴 ناموفق' + (r && r.error ? ' — ' + r.error : '');
            }
          } catch (e) {
            badge.className = 'ping-badge bad';
            badge.textContent = '🔴 خطا در تست';
          } finally {
            btn.disabled = false;
          }
        });
      });
    }

    document.getElementById('loadUserConfigsBtn').addEventListener('click', () => loadUserConfigs());
    document.getElementById('userConfigsUuidInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); loadUserConfigs(); }
    });

    document.getElementById('proForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/users/pro', { method: 'POST', body: JSON.stringify({
          telegramId: document.getElementById('proTelegramId').value,
          telegramName: document.getElementById('proTelegramName').value,
          days: Number(document.getElementById('proDays').value),
          volumeGb: Number(document.getElementById('proVolume').value),
        })});
        showToast('اشتراک پرو ساخته شد');
        e.target.reset();
        loadUsers(); loadOverview();
      } catch (e) { showToast(e.message, true); }
    });

    async function loadTrialSettings() {
      const data = await api('/api/admin/settings');
      document.getElementById('trialDuration').value = data.trial_duration_hours;
      document.getElementById('trialVolume').value = data.trial_volume_mb;
      document.getElementById('trialCooldown').value = data.trial_cooldown_hours;
      document.getElementById('notifyStepMb').value = data.usage_notify_step_mb || '400';
      document.getElementById('tgToken').value = data.telegram_bot_token || '';
      document.getElementById('tgAdminId').value = data.telegram_admin_id || '';
      document.getElementById('tgAdminUsername').value = data.telegram_admin_username || '';
      document.getElementById('requiredChannel').value = data.required_channel || '';
      document.getElementById('requiredChannelUrl').value = data.required_channel_url || '';
      document.getElementById('wikiGiftLink').value = data.wiki_gift_link || '';
      document.getElementById('proConfigName').value = data.pro_config_name || '';
      document.getElementById('trialConfigName').value = data.trial_config_name || '';
    }

    document.getElementById('trialForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({
          trial_duration_hours: document.getElementById('trialDuration').value,
          trial_volume_mb: document.getElementById('trialVolume').value,
          trial_cooldown_hours: document.getElementById('trialCooldown').value,
          usage_notify_step_mb: document.getElementById('notifyStepMb').value,
        })});
        showToast('تنظیمات ذخیره شد');
      } catch (e) { showToast(e.message, true); }
    });

    document.getElementById('configNameForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({
          pro_config_name: document.getElementById('proConfigName').value,
          trial_config_name: document.getElementById('trialConfigName').value,
        })});
        showToast('نام کانفیگ‌ها ذخیره شد');
      } catch (e) { showToast(e.message, true); }
    });

    document.getElementById('wikiGiftForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({
          wiki_gift_link: document.getElementById('wikiGiftLink').value,
        })});
        showToast('لینک جایزه ذخیره شد');
      } catch (e) { showToast(e.message, true); }
    });

    // ---------- Requirement #3: quota + kill switch ----------
    async function loadQuota() {
      const q = await api('/api/admin/quota');
      const pct = q.limit > 0 ? Math.min(100, (q.count / q.limit) * 100) : 0;
      const fill = document.getElementById('quotaBarFill');
      fill.style.width = pct + '%';
      // green while comfortably under quota, yellow as it climbs, red once it's close to the cap.
      const tier = pct >= 85 ? ' danger' : pct >= 60 ? ' warn' : '';
      fill.className = 'quota-bar' + tier;
      document.getElementById('quotaText').textContent =
        q.count.toLocaleString('fa-IR') + ' از ' + q.limit.toLocaleString('fa-IR') + ' اتصال امروز (' + pct.toFixed(1) + '٪) — تاریخ: ' + q.date;
      const pill = document.getElementById('serviceStatusPill');
      pill.textContent = q.paused ? '⏸️ متوقف شده' : '✅ فعال';
      pill.className = 'pill ' + (q.paused ? 'expired' : 'active');
      document.getElementById('dailyLimit').value = q.limit;
      document.getElementById('autoPause').checked = q.autoPause;
    }

    document.getElementById('pauseBtn').addEventListener('click', async () => {
      try { await api('/api/admin/quota/pause', { method: 'POST' }); showToast('همه اتصالات موقتاً قطع شدند'); loadQuota(); }
      catch (e) { showToast(e.message, true); }
    });
    document.getElementById('resumeBtn').addEventListener('click', async () => {
      try { await api('/api/admin/quota/resume', { method: 'POST' }); showToast('اتصالات وصل شدند'); loadQuota(); }
      catch (e) { showToast(e.message, true); }
    });

    document.getElementById('quotaForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/quota', { method: 'POST', body: JSON.stringify({
          dailyLimit: Number(document.getElementById('dailyLimit').value),
          autoPause: document.getElementById('autoPause').checked,
        })});
        showToast('تنظیمات ذخیره شد');
        loadQuota();
      } catch (e) { showToast(e.message, true); }
    });

    // ---------- Simple worker-to-worker sync secret (this worker's own) ----------
    async function loadSyncSecret() {
      try {
        const data = await api('/api/admin/sync-secret');
        document.getElementById('mySyncUrl').value = window.location.host;
        document.getElementById('mySyncSecret').value = data.secret;
      } catch (e) { showToast(e.message, true); }
    }
    document.getElementById('copySyncBtn').addEventListener('click', () => {
      const text = document.getElementById('mySyncUrl').value + '  —  ' + document.getElementById('mySyncSecret').value;
      navigator.clipboard.writeText(text).then(() => showToast('کپی شد')).catch(() => showToast('کپی نشد', true));
    });
    document.getElementById('regenSyncBtn').addEventListener('click', async () => {
      if (!confirm('با تولید رمز جدید، اکانت‌هایی که رمز قبلی را دارند دیگر نمی‌توانند به این ورکر وصل شوند مگر رمز جدید را به آن‌ها هم بدهید. ادامه می‌دهید؟')) return;
      try {
        await api('/api/admin/sync-secret/regenerate', { method: 'POST' });
        loadSyncSecret();
        showToast('رمز جدید ساخته شد');
      } catch (e) { showToast(e.message, true); }
    });

    // ---------- Requirement #4 + #1(3rd batch): backend worker pool / multi-account ----------
    function healthPill(w) {
      if (w.health_status === 'healthy') return '<span class="pill active">🟢 سالم</span>';
      if (w.health_status === 'unhealthy') return '<span class="pill" style="background:#5a1f1f;color:#ffb3b3;" title="' + (w.last_error || '') + '">🔴 مشکل‌دار</span>';
      return '<span class="pill neutral">⚪ بررسی‌نشده</span>';
    }
    const COUNTRY_FLAGS = { DE: '🇩🇪', TR: '🇹🇷', AE: '🇦🇪', FR: '🇫🇷', IT: '🇮🇹', RU: '🇷🇺', NL: '🇳🇱', GB: '🇬🇧', US: '🇺🇸' };
    const COUNTRY_NAMES_FA = { DE: 'آلمان', TR: 'ترکیه', AE: 'امارات', FR: 'فرانسه', IT: 'ایتالیا', RU: 'روسیه', NL: 'هلند', GB: 'انگلستان', US: 'آمریکا' };
    function countryCellHtml(code) {
      if (!code) return '-';
      const flag = COUNTRY_FLAGS[code] || '';
      const name = COUNTRY_NAMES_FA[code] || code;
      return (flag ? flag + ' ' : '') + name;
    }
    async function loadPool() {
      const data = await api('/api/admin/pool');
      document.getElementById('poolBatchSize').value = data.batchSize || '5';
      document.getElementById('poolRestDays').value = data.restDays || '1';
      const tbody = document.querySelector('#poolTable tbody');
      if (!data.pool.length) { tbody.innerHTML = '<tr><td colspan="7">هنوز اکانتی اضافه نشده — کانفیگ‌های VIP روی همین ورکر باقی می‌مانند</td></tr>'; return; }
      tbody.innerHTML = data.pool.map(w =>
        '<tr>' +
          '<td>' + countryCellHtml(w.country) + '</td>' +
          '<td style="font-family:monospace; font-size:0.75rem;">' + w.hostname + '</td>' +
          '<td>' + (w.label || '-') + '</td>' +
          '<td>' + healthPill(w) + '</td>' +
          '<td><span class="pill ' + (w.enabled && w.active ? 'active' : 'neutral') + '">' + (!w.enabled ? 'غیرفعال' : (w.active ? '🟢 فعال' : '😴 استراحت')) + '</span></td>' +
          '<td><button data-act="toggle" data-id="' + w.id + '" data-enabled="' + w.enabled + '">' + (w.enabled ? 'غیرفعال کن' : 'فعال کن') + '</button></td>' +
          '<td class="row-actions">' +
            '<button data-act="check" data-id="' + w.id + '">🩺 بررسی سلامت</button>' +
            '<button class="danger" data-act="delete" data-id="' + w.id + '">حذف</button>' +
          '</td>' +
        '</tr>'
      ).join('');
      tbody.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id, act = btn.dataset.act;
          try {
            if (act === 'toggle') {
              await api('/api/admin/pool/' + id, { method: 'PATCH', body: JSON.stringify({ enabled: btn.dataset.enabled !== 'true' }) });
            } else if (act === 'delete') {
              if (!confirm('این اکانت از استخر حذف شود؟')) return;
              await api('/api/admin/pool/' + id, { method: 'DELETE' });
            } else if (act === 'check') {
              btn.disabled = true; btn.textContent = 'در حال بررسی…';
              await api('/api/admin/pool/' + id + '/check', { method: 'POST' });
            }
            showToast('انجام شد');
            loadPool();
          } catch (e) { showToast(e.message, true); }
        });
      });
    }

    document.getElementById('poolAddForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/pool', { method: 'POST', body: JSON.stringify({
          url: document.getElementById('poolUrl').value,
          label: document.getElementById('poolLabel').value,
          country: document.getElementById('poolCountry').value,
          syncSecret: document.getElementById('poolSyncSecret').value,
          cfAccountId: document.getElementById('poolAccountId').value,
          cfApiToken: document.getElementById('poolApiToken').value,
          cfDatabaseId: document.getElementById('poolDatabaseId').value,
          cfScriptName: document.getElementById('poolScriptName').value,
        })});
        showToast('اکانت اضافه شد');
        e.target.reset();
        loadPool();
      } catch (e) { showToast(e.message, true); }
    });

    document.getElementById('poolSettingsSaveBtn').addEventListener('click', async () => {
      try {
        await api('/api/admin/pool/settings', { method: 'POST', body: JSON.stringify({
          batchSize: Number(document.getElementById('poolBatchSize').value),
          restDays: Number(document.getElementById('poolRestDays').value),
        })});
        showToast('تنظیمات چرخش ذخیره شد');
        loadPool();
      } catch (e) { showToast(e.message, true); }
    });

    document.getElementById('poolCheckAllBtn').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true; const orig = btn.textContent; btn.textContent = 'در حال بررسی همه…';
      try {
        await api('/api/admin/pool/check-all', { method: 'POST' });
        showToast('بررسی سلامت انجام شد');
        loadPool();
      } catch (e) { showToast(e.message, true); }
      finally { btn.disabled = false; btn.textContent = orig; }
    });

    document.getElementById('poolResyncAllBtn').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true; const orig = btn.textContent; btn.textContent = 'در حال sync…';
      try {
        const res = await api('/api/admin/pool/resync-all-users', { method: 'POST' });
        const totalSynced = (res.results || []).reduce((s, r) => s + r.synced, 0);
        const totalFailed = (res.results || []).reduce((s, r) => s + r.failed, 0);
        showToast('sync شد: ' + totalSynced + ' موفق' + (totalFailed ? '، ' + totalFailed + ' ناموفق' : ''));
      } catch (e) { showToast(e.message, true); }
      finally { btn.disabled = false; btn.textContent = orig; }
    });

    // ---------- Requirement #5: manually-entered "healthy IP" list (no scanning) ----------
    async function loadAutoCleanIpToggle() {
      const settings = await api('/api/admin/settings');
      document.getElementById('autoCleanIp').checked = settings.clean_ip_override_enabled === '1';
    }
    document.getElementById('autoCleanIpSaveBtn').addEventListener('click', async () => {
      try {
        await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({
          clean_ip_override_enabled: document.getElementById('autoCleanIp').checked ? '1' : '0',
        })});
        showToast('ذخیره شد');
      } catch (e) { showToast(e.message, true); }
    });
    function renderCleanIps(ips) {
      const tbody = document.querySelector('#cleanIpsTable tbody');
      if (!ips.length) { tbody.innerHTML = '<tr><td colspan="7">هنوز آی‌پی‌ای اضافه نشده</td></tr>'; return; }
      tbody.innerHTML = ips.map(ip => {
        const flag = countryCellHtml(ip.country);
        const deleteBtn = ip.fromFile
          ? '<span style="opacity:0.6; font-size:0.72rem;" title="این ردیف از src/data/rented-clean-ips.ts می‌آید">—</span>'
          : '<button class="btn btn-sub cleanIpDeleteBtn" data-id="' + ip.id + '" type="button">🗑 حذف</button>';
        return (
          '<tr>' +
            '<td>' + flag + '</td>' +
            '<td style="font-family:monospace;">' + ip.ip + '</td>' +
            '<td style="font-family:monospace;">' + ip.port + '</td>' +
            '<td>' + (ip.note || '-') + '</td>' +
            '<td style="font-size:0.72rem;">' + (ip.fromFile ? '📄 فایل' : '🗄 داشبورد') + '</td>' +
            '<td style="font-size:0.72rem;">' + (ip.fromFile ? '-' : fmtDate(ip.created_at)) + '</td>' +
            '<td>' + deleteBtn + '</td>' +
          '</tr>'
        );
      }).join('');
      document.querySelectorAll('.cleanIpDeleteBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const data = await api('/api/admin/clean-ips/' + btn.dataset.id, { method: 'DELETE' });
            renderCleanIps(data.ips);
            showToast('حذف شد');
          } catch (e) { showToast(e.message, true); }
        });
      });
    }
    async function loadCleanIps() {
      const data = await api('/api/admin/clean-ips');
      renderCleanIps(data.ips);
    }
    document.getElementById('cleanIpForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = await api('/api/admin/clean-ips', { method: 'POST', body: JSON.stringify({
          ip: document.getElementById('cleanIpValue').value,
          port: document.getElementById('cleanIpPort').value,
          note: document.getElementById('cleanIpNote').value,
          country: document.getElementById('cleanIpCountry').value,
        })});
        renderCleanIps(data.ips);
        e.target.reset();
        document.getElementById('cleanIpPort').value = '443';
        showToast('اضافه شد');
      } catch (e) { showToast(e.message, true); }
    });

    // ---------- In-panel automatic scanner (SOCKS4 / TLS-SNI) ----------
    function renderScanResults(results) {
      const table = document.getElementById('scanResultsTable');
      const tbody = table.querySelector('tbody');
      table.style.display = results.length ? 'table' : 'none';
      tbody.innerHTML = results.map((r, i) => {
        const statusPill = r.success
          ? '<span class="pill active">سالم ✅</span>'
          : '<span class="pill expired">قطع ❌</span>';
        const addBtn = r.success
          ? '<button class="btn btn-sub scanAddBtn" data-i="' + i + '" type="button">➕ افزودن به لیست</button>'
          : '';
        return (
          '<tr>' +
            '<td>' + countryCellHtml(r.country) + '</td>' +
            '<td style="font-family:monospace;">' + r.ip + '</td>' +
            '<td style="font-family:monospace;">' + r.port + '</td>' +
            '<td>' + statusPill + '</td>' +
            '<td>' + (r.success ? r.ping + ' ms' : '-') + '</td>' +
            '<td style="font-size:0.72rem; opacity:0.75;">' + (r.error || '-') + '</td>' +
            '<td>' + addBtn + '</td>' +
          '</tr>'
        );
      }).join('');
      tbody.querySelectorAll('.scanAddBtn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const r = results[Number(btn.dataset.i)];
          try {
            // r.country comes straight from the clean_ips/rented-clean-ips.ts row this
            // address was scanned from (see ip-scanner.ts) — not detected here, just
            // forwarded, so an already-tagged IP keeps its flag without re-picking it.
            const data = await api('/api/admin/clean-ips', { method: 'POST', body: JSON.stringify({
              ip: r.ip, port: r.port, note: 'اسکن خودکار (' + r.ping + ' ms)', country: r.country || '',
            })});
            renderCleanIps(data.ips);
            showToast('به لیست اضافه شد');
          } catch (e) { showToast(e.message, true); }
        });
      });
    }

    async function runScan(mode, btn) {
      const statusText = document.getElementById('scanStatusText');
      const otherBtn = mode === 'socks4' ? document.getElementById('scanSniBtn') : document.getElementById('scanSocks4Btn');
      btn.disabled = true; otherBtn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = '⏳ در حال اسکن…';
      statusText.textContent = 'در حال بررسی همه آی‌پی‌های لیست از داخل خود ورکر…';
      try {
        const data = await api('/api/admin/clean-ips/scan', { method: 'POST', body: JSON.stringify({ mode }) });
        renderScanResults(data.results);
        const healthy = data.results.filter((r) => r.success).length;
        statusText.textContent = mode === 'sni'
          ? ('اسکن با SNI = ' + data.sni + ' انجام شد — ' + healthy + ' از ' + data.results.length + ' نتیجه سالم')
          : ('اسکن SOCKS4 انجام شد — ' + healthy + ' از ' + data.results.length + ' سالم');
      } catch (e) {
        statusText.textContent = '';
        showToast(e.message, true);
      } finally {
        btn.disabled = false; otherBtn.disabled = false;
        btn.textContent = orig;
      }
    }
    document.getElementById('scanSocks4Btn').addEventListener('click', (e) => runScan('socks4', e.target));
    document.getElementById('scanSniBtn').addEventListener('click', (e) => runScan('sni', e.target));

    // ---------- Discover-new-candidates scanner ----------
    const DEFAULT_SNI_PORTS = [443, 2053, 2083, 2087, 2096, 8443];
    (function initCandidatePorts() {
      const row = document.getElementById('candidatePortsRow');
      if (!row) return;
      row.innerHTML = DEFAULT_SNI_PORTS.map((p, i) =>
        '<label><input type="checkbox" value="' + p + '"' + (i === 0 ? ' checked' : '') + ' />' + p + '</label>'
      ).join('');
    })();

    let lastCandidateResults = [];

    function renderCandidateResults(results) {
      const table = document.getElementById('candidateResultsTable');
      const tbody = table.querySelector('tbody');
      table.style.display = results.length ? 'table' : 'none';
      const addAllBtn = document.getElementById('addAllHealthyBtn');
      const healthyCount = results.filter((r) => r.success).length;
      addAllBtn.style.display = healthyCount ? 'inline-flex' : 'none';
      tbody.innerHTML = results.map((r, i) => {
        const statusPill = r.success
          ? '<span class="pill active">سالم ✅</span>'
          : '<span class="pill expired">قطع ❌</span>';
        const addBtn = r.success
          ? '<button class="btn btn-sub candidateAddBtn" data-i="' + i + '" type="button">➕ افزودن</button>'
          : '';
        return (
          '<tr>' +
            '<td>' + countryCellHtml(r.country) + '</td>' +
            '<td style="font-family:monospace;">' + r.ip + '</td>' +
            '<td style="font-family:monospace;">' + r.port + '</td>' +
            '<td>' + statusPill + '</td>' +
            '<td>' + (r.success ? r.ping + ' ms' : '-') + '</td>' +
            '<td style="font-size:0.72rem; opacity:0.75;">' + (r.error || '-') + '</td>' +
            '<td>' + addBtn + '</td>' +
          '</tr>'
        );
      }).join('');
      tbody.querySelectorAll('.candidateAddBtn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const r = results[Number(btn.dataset.i)];
          try {
            const data = await api('/api/admin/clean-ips', { method: 'POST', body: JSON.stringify({
              ip: r.ip, port: r.port, note: 'کشف‌شده با اسکنر (' + r.ping + ' ms)', country: r.country || '',
            })});
            renderCleanIps(data.ips);
            showToast('به لیست اضافه شد');
          } catch (e) { showToast(e.message, true); }
        });
      });
    }

    document.getElementById('addAllHealthyBtn').addEventListener('click', async () => {
      const healthy = lastCandidateResults.filter((r) => r.success);
      if (!healthy.length) return;
      const btn = document.getElementById('addAllHealthyBtn');
      btn.disabled = true;
      let added = 0;
      try {
        for (const r of healthy) {
          try {
            await api('/api/admin/clean-ips', { method: 'POST', body: JSON.stringify({
              ip: r.ip, port: r.port, note: 'کشف‌شده با اسکنر (' + r.ping + ' ms)', country: r.country || '',
            })});
            added++;
          } catch { /* skip duplicates/errors, keep going */ }
        }
        await loadCleanIps();
        showToast(added + ' آی‌پی سالم به لیست اضافه شد');
      } finally {
        btn.disabled = false;
      }
    });

    // ---------- Radar: fully automatic clean-IP discovery ----------
    // Everything in this block runs on whoever's browser clicked the button —
    // never on the server — because the whole point is to measure reachability
    // and speed from THAT specific network (the same reason the manual scanner
    // above uses the dashboard's own domain as SNI: there is no way to know
    // "which Cloudflare IPs work well right now" except by actually trying from
    // the network in question). The candidate addresses come only from
    // Cloudflare's own officially published IPv4 ranges (see
    // https://www.cloudflare.com/ips-v4/ — update this list if Cloudflare ever
    // changes it, which is rare) — nothing is fetched or scraped from any
    // third party.
    const CF_IPV4_RANGES = [
      '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
      '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
      '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
      '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    ];
    const RADAR_SAMPLE_SIZE = 45;
    const RADAR_SHORTLIST_SIZE = 16;
    const RADAR_PROBE_TIMEOUT_MS = 2500;
    const RADAR_PROBE_CONCURRENCY = 8;

    function ipToInt(ip) {
      return ip.split('.').reduce((acc, part) => ((acc << 8) + Number(part)) >>> 0, 0) >>> 0;
    }
    function intToIp(n) {
      return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    }
    function randomIpInCidr(cidr) {
      const [base, prefixStr] = cidr.split('/');
      const prefix = Number(prefixStr);
      const baseInt = ipToInt(base);
      const hostBits = 32 - prefix;
      const size = hostBits >= 31 ? 2 : Math.pow(2, hostBits);
      const mask = hostBits >= 32 ? 0 : (~(size - 1)) >>> 0;
      const networkInt = (baseInt & mask) >>> 0;
      const span = Math.max(size - 2, 1); // avoid network/broadcast edges
      const offset = 1 + Math.floor(Math.random() * span);
      return intToIp((networkInt + offset) >>> 0);
    }
    function generateRadarCandidates(count) {
      const set = new Set();
      let guard = 0;
      while (set.size < count && guard < count * 20) {
        guard++;
        const cidr = CF_IPV4_RANGES[Math.floor(Math.random() * CF_IPV4_RANGES.length)];
        set.add(randomIpInCidr(cidr));
      }
      return Array.from(set);
    }
    // Times how long it takes the browser to even GET a reply/error from
    // ip:443. We never expect this fetch to actually succeed (Cloudflare's
    // certificate for our zone was never issued for a bare IP address, so the
    // browser will reject it) — the only thing that matters is the elapsed
    // time before that rejection. A fast rejection means the browser reached
    // a live TLS endpoint and started (and lost) the handshake quickly, i.e.
    // this address is open and responsive on the current network right now;
    // hitting our own timeout means nothing came back at all (likely blocked
    // or filtered on this ISP). This can't be 100% precise from inside a
    // browser — see the note above the button — which is exactly why every
    // survivor still gets a real SNI/TLS handshake test on the worker itself
    // afterwards, via the existing /api/admin/clean-ips/scan-candidates.
    async function probeIp(ip, timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const start = performance.now();
      try {
        await fetch('https://' + ip + '/cdn-cgi/trace', {
          signal: controller.signal, cache: 'no-store', mode: 'no-cors', redirect: 'manual',
        });
        return { ip, elapsed: performance.now() - start, reachable: true };
      } catch (err) {
        const elapsed = performance.now() - start;
        if (controller.signal.aborted) return { ip, elapsed, reachable: false };
        return { ip, elapsed, reachable: true };
      } finally {
        clearTimeout(timer);
      }
    }

    document.getElementById('radarScanBtn').addEventListener('click', async () => {
      const btn = document.getElementById('radarScanBtn');
      const statusText = document.getElementById('radarStatusText');
      const progressWrap = document.getElementById('radarProgressWrap');
      const progressFill = document.getElementById('radarProgressFill');
      const orig = btn.textContent;
      btn.disabled = true;
      progressWrap.style.display = 'block';
      progressFill.style.width = '5%';
      try {
        btn.textContent = '🛰️ در حال آزمایش شبکه فعلی…';
        statusText.textContent = 'در حال تست چند ده آی‌پی از رنج‌های رسمی Cloudflare، مستقیماً از همین مرورگر…';

        const candidates = generateRadarCandidates(RADAR_SAMPLE_SIZE);
        const probeResults = [];
        for (let i = 0; i < candidates.length; i += RADAR_PROBE_CONCURRENCY) {
          const batch = candidates.slice(i, i + RADAR_PROBE_CONCURRENCY);
          const batchResults = await Promise.all(batch.map((ip) => probeIp(ip, RADAR_PROBE_TIMEOUT_MS)));
          probeResults.push(...batchResults);
          progressFill.style.width = Math.min(10 + Math.round(((i + batch.length) / candidates.length) * 55), 65) + '%';
        }

        const reachable = probeResults.filter((r) => r.reachable).sort((a, b) => a.elapsed - b.elapsed);
        const shortlist = reachable.slice(0, RADAR_SHORTLIST_SIZE).map((r) => r.ip);

        if (!shortlist.length) {
          statusText.textContent = 'هیچ آی‌پی‌ای از شبکه فعلی قابل‌دسترس تشخیص داده نشد. چند لحظه دیگر دوباره امتحان کنید، یا از باکس دستی پایین استفاده کنید.';
          return;
        }

        document.getElementById('candidateInput').value = shortlist.join('\\n');
        statusText.textContent = shortlist.length + ' آی‌پی سریع از شبکه فعلی پیدا شد — در حال تأیید نهایی (هندشیک واقعی TLS/SNI) روی خود ورکر…';
        btn.textContent = '🔒 در حال تأیید نهایی…';
        progressFill.style.width = '75%';

        const checkedPorts = Array.from(document.querySelectorAll('#candidatePortsRow input:checked')).map((el) => Number(el.value));
        const ports = checkedPorts.length ? checkedPorts : DEFAULT_SNI_PORTS;
        const country = document.getElementById('candidateCountry').value;

        const data = await api('/api/admin/clean-ips/scan-candidates', { method: 'POST', body: JSON.stringify({
          candidates: shortlist, ports, country,
        })});
        lastCandidateResults = data.results || [];
        renderCandidateResults(lastCandidateResults);
        const healthy = lastCandidateResults.filter((r) => r.success).length;
        progressFill.style.width = '100%';
        statusText.textContent = healthy + ' آی‌پی سالم (از ' + lastCandidateResults.length + ' موردِ تأییدشده روی ورکر) پیدا شد و پایین صفحه آماده‌ی افزودن است.';
      } catch (err) {
        statusText.textContent = '';
        showToast(err.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
        setTimeout(() => { progressWrap.style.display = 'none'; progressFill.style.width = '0%'; }, 600);
      }
    });

    document.getElementById('scanCandidatesBtn').addEventListener('click', async (e) => {
      const btn = e.target;
      const statusText = document.getElementById('candidateStatusText');
      const progressWrap = document.getElementById('candidateProgressWrap');
      const progressFill = document.getElementById('candidateProgressFill');
      const raw = document.getElementById('candidateInput').value.trim();
      if (!raw) { showToast('یک یا چند آی‌پی وارد کنید', true); return; }

      const checkedPorts = Array.from(document.querySelectorAll('#candidatePortsRow input:checked')).map((el) => Number(el.value));
      const customPortsRaw = document.getElementById('candidateCustomPorts').value.trim();
      const customPorts = customPortsRaw
        ? customPortsRaw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 1 && n <= 65535)
        : [];
      const ports = Array.from(new Set([...checkedPorts, ...customPorts]));
      const country = document.getElementById('candidateCountry').value;

      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = '⏳ در حال اسکن…';
      statusText.textContent = 'در حال تست هر آی‌پی روی پورت‌های انتخابی از داخل خود ورکر… ممکن است چند ثانیه طول بکشد.';
      progressWrap.style.display = 'block';
      progressFill.style.width = '8%';
      let fakeProgress = 8;
      const progressTimer = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + Math.random() * 12, 92);
        progressFill.style.width = fakeProgress + '%';
      }, 500);

      try {
        const data = await api('/api/admin/clean-ips/scan-candidates', { method: 'POST', body: JSON.stringify({
          candidates: raw, ports, country,
        })});
        lastCandidateResults = data.results || [];
        renderCandidateResults(lastCandidateResults);
        const healthy = lastCandidateResults.filter((r) => r.success).length;
        statusText.textContent = healthy + ' مورد سالم از ' + lastCandidateResults.length + ' تست پیدا شد.' +
          (data.truncated ? (' (فقط ' + data.maxJobs + ' ترکیب اول تست شد؛ لیست کوتاه‌تری بفرستید تا همه تست شوند)') : '');
      } catch (err) {
        statusText.textContent = '';
        showToast(err.message, true);
      } finally {
        clearInterval(progressTimer);
        progressFill.style.width = '100%';
        setTimeout(() => { progressWrap.style.display = 'none'; progressFill.style.width = '0%'; }, 500);
        btn.disabled = false;
        btn.textContent = orig;
      }
    });

    // ---------- Public DNS routing list (Private DNS / DoT feature) ----------
    function dnsKindLabel(kind) {
      if (kind === 'domain') return 'دامنه';
      if (kind === 'ip') return 'آی‌پی';
      return 'رنج (CIDR)';
    }
    function renderDnsRules(rules) {
      const tbody = document.querySelector('#dnsRulesTable tbody');
      const countPill = document.getElementById('dnsRuleCountPill');
      if (countPill) countPill.textContent = rules.length + ' مورد';
      if (!rules.length) { tbody.innerHTML = '<tr><td colspan="5">هنوز موردی اضافه نشده</td></tr>'; return; }
      tbody.innerHTML = rules.map(r =>
        '<tr>' +
          '<td><span class="dns-badge ' + r.kind + '">' + dnsKindLabel(r.kind) + '</span></td>' +
          '<td style="font-family:monospace;">' + r.value + '</td>' +
          '<td>' + (r.note || '-') + '</td>' +
          '<td style="font-size:0.72rem;">' + fmtDate(r.created_at) + '</td>' +
          '<td><button class="btn btn-sub dnsRuleDeleteBtn" data-id="' + r.id + '" type="button">🗑 حذف</button></td>' +
        '</tr>'
      ).join('');
      document.querySelectorAll('.dnsRuleDeleteBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const data = await api('/api/admin/dns-rules/' + btn.dataset.id, { method: 'DELETE' });
            renderDnsRules(data.rules);
            showToast('حذف شد');
          } catch (e) { showToast(e.message, true); }
        });
      });
    }
    async function loadDnsRules() {
      const data = await api('/api/admin/dns-rules');
      renderDnsRules(data.rules);
    }
    document.getElementById('dnsRuleForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = await api('/api/admin/dns-rules', { method: 'POST', body: JSON.stringify({
          kind: document.getElementById('dnsRuleKind').value,
          value: document.getElementById('dnsRuleValue').value,
          note: document.getElementById('dnsRuleNote').value,
        })});
        renderDnsRules(data.rules);
        e.target.reset();
        showToast('اضافه شد');
      } catch (e) { showToast(e.message, true); }
    });

    async function loadBotUsers() {
      const data = await api('/api/admin/bot-users');
      const tbody = document.querySelector('#botUsersTable tbody');
      if (!data.botUsers.length) { tbody.innerHTML = '<tr><td colspan="5">هنوز کسی وارد ربات نشده</td></tr>'; return; }
      tbody.innerHTML = data.botUsers.map(u =>
        '<tr>' +
          '<td style="font-family:monospace;">' + u.telegram_id + '</td>' +
          '<td>' + (u.telegram_name || '-') + '</td>' +
          '<td style="font-size:0.72rem;">' + fmtDate(u.first_seen) + '</td>' +
          '<td style="font-size:0.72rem;">' + fmtDate(u.last_seen) + '</td>' +
          '<td>' + u.messages + '</td>' +
        '</tr>'
      ).join('');
    }

    document.getElementById('tgForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({
          telegram_bot_token: document.getElementById('tgToken').value,
          telegram_admin_id: document.getElementById('tgAdminId').value,
          telegram_admin_username: document.getElementById('tgAdminUsername').value,
          required_channel: document.getElementById('requiredChannel').value,
          required_channel_url: document.getElementById('requiredChannelUrl').value,
        })});
        showToast('تنظیمات ربات ذخیره شد');
      } catch (e) { showToast(e.message, true); }
    });

    document.getElementById('setWebhookBtn').addEventListener('click', async () => {
      try {
        const data = await api('/api/admin/telegram/set-webhook', { method: 'POST' });
        showToast(data.ok ? 'Webhook فعال شد ✅' : 'خطا در فعال‌سازی Webhook', !data.ok);
      } catch (e) { showToast(e.message, true); }
    });

    document.getElementById('pwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/change-password', { method: 'POST', body: JSON.stringify({
          currentPassword: document.getElementById('curPw').value,
          newPassword: document.getElementById('newPw').value,
        })});
        showToast('رمز عبور تغییر کرد');
        e.target.reset();
      } catch (e) { showToast(e.message, true); }
    });

    // Each section loads independently — if one tab's data fails to load (bad
    // response, missing element, etc.) it's logged and toasted but never takes
    // down the rest of the panel or leaves the page stuck on a blank screen.
    [loadOverview, loadUsers, loadBotUsers, loadTrialSettings, loadQuota, loadPool, loadSyncSecret, loadCleanIps, loadAutoCleanIpToggle, loadDnsRules]
      .forEach((fn) => {
        try {
          Promise.resolve(fn()).catch((e) => { console.error(fn.name, e); showToast((fn.name) + ': ' + e.message, true); });
        } catch (e) { console.error(fn.name, e); }
      });

    // Live numbers (per-user usage, Cloudflare daily quota, overview stats)
    // keep changing on the server while the dashboard sits open in a browser
    // tab, so re-poll them periodically instead of only ever showing the one
    // snapshot fetched at page-load — this is what actually made the panel
    // look "not updating" even though the underlying data was fine.
    const USERS_POLL_MS = 20000;
    setInterval(() => {
      if (document.hidden) return;
      Promise.resolve(loadOverview()).catch(() => {});
      Promise.resolve(loadUsers()).catch(() => {});
      Promise.resolve(loadQuota()).catch(() => {});
    }, USERS_POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        Promise.resolve(loadOverview()).catch(() => {});
        Promise.resolve(loadUsers()).catch(() => {});
        Promise.resolve(loadQuota()).catch(() => {});
      }
    });

    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    if (refreshUsersBtn) {
      refreshUsersBtn.addEventListener('click', async () => {
        refreshUsersBtn.disabled = true;
        const origText = refreshUsersBtn.textContent;
        refreshUsersBtn.textContent = '⏳ در حال بروزرسانی…';
        try { await loadUsers(); await loadOverview(); showToast('لیست بروز شد'); }
        catch (e) { showToast(e.message, true); }
        finally { refreshUsersBtn.disabled = false; refreshUsersBtn.textContent = origText; }
      });
    }
  })();
  </script>`
  return new Response(shell('پنل مدیریت | BNDMAX VPN', body, dashboardStyle), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
