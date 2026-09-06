"""
Clean-IP Scanner (private, owned-servers-only edition)
=======================================================
این ابزار فقط فایل‌های proxy/*.txt مجاز را از روی دیسک محلی می‌خواند و
صرفاً همان سرورهای خودِ شما را تست می‌کند. هیچ درخواستی به هیچ منبع
خارجی/گیت‌هاب زده نمی‌شود و هیچ آی‌پی دیگری غیر از چیزی که خودتان داخل
این فایل‌ها گذاشته‌اید اسکن نمی‌گردد.

دو حالت اسکن پشتیبانی می‌شود:
  1) SOCKS4  — هندشیک واقعی SOCKS4 روی همان پورتی که در فایل نوشته‌اید.
  2) SNI/TLS — دقیقاً مکانیزم «اسکنر آی‌پی تمیز» پروژه ۲: یک هندشیک TLS با
     SNI مشخص، روی همان مجموعه پورت‌هایی که پروژه ۲ استفاده می‌کند
     (443, 2053, 2083, 2087, 2096, 8443) — چون این پورت‌ها همان پورت‌های
     TLS کلادفلر هستند، نه پورت پیش‌فرض SOCKS شما.
     دامنه/SNI به‌صورت خودکار از روی اکانت کلادفلر شما (با همان روش خود
     پنل: verify توکن -> پیدا کردن Account ID -> گرفتن ساب‌دامین ورکرها)
     و نام ورکر داخل wrangler.toml ساخته می‌شود؛ نیازی به تایپ دستی نیست.

اجرا:
    python3 server.py
سپس در مرورگر باز کنید: http://127.0.0.1:8000/
"""

import socket
import ssl
import struct
import time
import json
import os
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from concurrent.futures import ThreadPoolExecutor

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)  # my-vpn-updated/
PROXY_DIR = os.path.join(BASE_DIR, "proxy")
CONFIG_PATH = os.path.join(BASE_DIR, "config.local.json")  # هرگز نباید commit شود — شامل توکن است
ALLOWED_FILES = {"de.txt", "tr.txt", "ru.txt", "az.txt", "uae.txt"}  # فقط همین‌ها — بقیه کشورها عمداً اضافه نشده‌اند
SCAN_EXECUTOR = ThreadPoolExecutor(max_workers=10)

# مقصدی که برای تست CONNECT از داخل پروکسی SOCKS4 استفاده می‌شود (فقط سنجش سلامت)
TEST_TARGET_HOST = "1.1.1.1"
TEST_TARGET_PORT = 80

# همان مجموعه پورت‌های TLS که پروژه ۲ / پنل استفاده می‌کند (src/constants یا Source.js: TLS_PORTS)
SNI_PORTS = [443, 2053, 2083, 2087, 2096, 8443]
CF_API = "https://api.cloudflare.com/client/v4"


def _cf_api_get(path, token):
    req = urllib.request.Request(CF_API + path, headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read().decode("utf-8"))


def get_worker_name():
    """نام ورکر را از wrangler.toml می‌خواند (همان چیزی که کلادفلر واقعاً دیپلوی کرده)."""
    wrangler_path = os.path.join(PROJECT_ROOT, "wrangler.toml")
    try:
        with open(wrangler_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("name") and "=" in line:
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return None


def load_config():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_config(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    try:
        os.chmod(CONFIG_PATH, 0o600)
    except Exception:
        pass


def resolve_cf_domain(force_refresh=False):
    """
    دامنه/SNI را خودکار می‌سازد:
      1) اگر manual_domain در config.local.json ذخیره شده باشد همان استفاده می‌شود.
      2) وگرنه با CF_API_TOKEN، دقیقاً مثل src/services/cf-accounts.ts:
         /user/tokens/verify -> /accounts -> /accounts/{id}/workers/subdomain
         و ترکیب با نام ورکر از wrangler.toml -> "<name>.<subdomain>.workers.dev"
    نتیجه به مدت ۶ ساعت کش می‌شود تا هر بار به کلادفلر درخواست نزنیم.
    """
    cfg = load_config()
    if cfg.get("manual_domain"):
        return {"domain": cfg["manual_domain"], "source": "manual"}

    now = time.time()
    if not force_refresh and cfg.get("cached_domain") and now - cfg.get("cached_at", 0) < 21600:
        return {"domain": cfg["cached_domain"], "source": "cloudflare (cached)"}

    token = cfg.get("cf_api_token") or os.environ.get("CF_API_TOKEN")
    if not token:
        return {"domain": None, "source": None, "needs_token": True}

    try:
        verify = _cf_api_get("/user/tokens/verify", token)
        if not verify.get("success"):
            return {"domain": None, "source": None, "error": "توکن نامعتبر است"}

        account_id = cfg.get("cf_account_id")
        if not account_id:
            accounts = _cf_api_get("/accounts", token)
            if not accounts.get("success") or not accounts.get("result"):
                return {"domain": None, "source": None, "error": "اکانتی برای این توکن یافت نشد"}
            account_id = accounts["result"][0]["id"]

        sub = _cf_api_get(f"/accounts/{account_id}/workers/subdomain", token)
        if not sub.get("success") or not sub.get("result", {}).get("subdomain"):
            return {"domain": None, "source": None, "error": "ساب‌دامین ورکرها پیدا نشد"}
        subdomain = sub["result"]["subdomain"]

        worker_name = get_worker_name() or "my-vpn"
        domain = f"{worker_name}.{subdomain}.workers.dev"

        cfg["cf_account_id"] = account_id
        cfg["cached_domain"] = domain
        cfg["cached_at"] = now
        save_config(cfg)
        return {"domain": domain, "source": "cloudflare"}
    except urllib.error.URLError as e:
        return {"domain": None, "source": None, "error": f"خطای شبکه در ارتباط با کلادفلر: {e}"}
    except Exception as e:
        return {"domain": None, "source": None, "error": str(e)}


def sni_handshake(ip, port, sni, timeout=4.0):
    """هندشیک TLS واقعی روی ip:port با SNI مشخص + یک درخواست GET، دقیقاً مثل اسکنر پروژه ۲."""
    start = time.time()
    try:
        with socket.create_connection((ip, port), timeout=timeout) as sock:
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            with context.wrap_socket(sock, server_hostname=sni) as ssock:
                req = f"GET / HTTP/1.1\r\nHost: {sni}\r\nUser-Agent: clean-ip-scanner\r\nConnection: close\r\n\r\n"
                ssock.sendall(req.encode("ascii"))
                resp = ssock.recv(2048)
                ping_ms = int((time.time() - start) * 1000)
                if resp.startswith(b"HTTP/1."):
                    return {"ip": ip, "port": port, "success": True, "ping": ping_ms}
                return {"ip": ip, "port": port, "success": False, "error": "پاسخ HTTP نامعتبر"}
    except Exception as e:
        return {"ip": ip, "port": port, "success": False, "error": str(e)}


def load_local_proxies():
    """فقط از دو فایل مجاز روی دیسک می‌خواند، هیچ فچ خارجی‌ای وجود ندارد."""
    data = {}
    for fname in sorted(ALLOWED_FILES):
        fpath = os.path.join(PROXY_DIR, fname)
        if not os.path.isfile(fpath):
            continue
        country = fname.replace(".txt", "").upper()
        with open(fpath, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip()]
        proxies = []
        for line in lines:
            uri = line.replace("socks4://", "").replace("socks4a://", "")
            if ":" not in uri:
                continue
            ip, port_str = uri.rsplit(":", 1)
            try:
                port = int(port_str)
            except ValueError:
                continue
            proxies.append({"ip": ip, "port": port})
        if proxies:
            data[country] = proxies
    return data


def socks4_handshake(ip, port, timeout=4.0):
    """
    اتصال واقعی SOCKS4 به سرور خودتان و ارسال یک درخواست CONNECT به مقصد تست.
    فقط سلامت/زنده‌بودن پروکسی و پینگ سنجیده می‌شود.
    """
    start = time.time()
    try:
        with socket.create_connection((ip, port), timeout=timeout) as sock:
            dest_ip_packed = socket.inet_aton(
                socket.gethostbyname(TEST_TARGET_HOST)
            )
            packet = struct.pack(
                "!BBH", 0x04, 0x01, TEST_TARGET_PORT
            ) + dest_ip_packed + b"\x00"
            sock.sendall(packet)
            resp = sock.recv(8)
            ping_ms = int((time.time() - start) * 1000)
            if len(resp) >= 2 and resp[0] == 0x00 and resp[1] == 0x5A:
                return {"ip": ip, "port": port, "success": True, "ping": ping_ms}
            return {
                "ip": ip,
                "port": port,
                "success": False,
                "error": f"SOCKS4 rejected (code {resp[1] if len(resp) > 1 else '?'})",
            }
    except Exception as e:
        return {"ip": ip, "port": port, "success": False, "error": str(e)}


class ScannerHandler(BaseHTTPRequestHandler):
    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/ping":
            self._send_json({"status": "online"})
            return
        if self.path.startswith("/api/proxies"):
            self._send_json(load_local_proxies())
            return
        if self.path.startswith("/api/domain"):
            force = "refresh=1" in self.path
            self._send_json(resolve_cf_domain(force_refresh=force))
            return
        if self.path in ("/", "/index.html"):
            index_path = os.path.join(BASE_DIR, "index.html")
            try:
                with open(index_path, "rb") as f:
                    html = f.read()
                self.send_response(200)
                self.send_header("Content-type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(html)))
                self.end_headers()
                self.wfile.write(html)
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
            return
        # سرو کردن فایل‌های استاتیک داخل پوشه proxy (فقط دو فایل مجاز) در صورت درخواست مستقیم
        if self.path.startswith("/proxy/"):
            fname = self.path.split("/proxy/", 1)[1].split("?")[0]
            if fname in ALLOWED_FILES:
                fpath = os.path.join(PROXY_DIR, fname)
                if os.path.isfile(fpath):
                    with open(fpath, "rb") as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header("Content-type", "text/plain; charset=utf-8")
                    self.send_header("Content-Length", str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                    return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/setup-token":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                token = (body.get("token") or "").strip()
                manual_domain = (body.get("manual_domain") or "").strip()
                cfg = load_config()
                if manual_domain:
                    cfg["manual_domain"] = manual_domain
                    cfg.pop("cached_domain", None)
                    save_config(cfg)
                    self._send_json({"success": True, "domain": manual_domain, "source": "manual"})
                    return
                if not token:
                    self._send_json({"error": "توکن یا دامنه دستی وارد نشده"}, 400)
                    return
                cfg["cf_api_token"] = token
                cfg.pop("manual_domain", None)
                cfg.pop("cached_domain", None)
                save_config(cfg)
                result = resolve_cf_domain(force_refresh=True)
                if result.get("domain"):
                    self._send_json({"success": True, **result})
                else:
                    self._send_json({"error": result.get("error") or "دامنه پیدا نشد"}, 400)
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
            return

        if self.path != "/api/scan":
            self.send_response(404)
            self.end_headers()
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
            country = (body.get("country") or "ALL").upper()
            mode = (body.get("mode") or "socks4").lower()

            local = load_local_proxies()
            if country == "ALL":
                targets = [p for lst in local.values() for p in lst]
            else:
                targets = local.get(country, [])

            if mode == "sni":
                domain_info = resolve_cf_domain()
                sni = body.get("sni_domain") or domain_info.get("domain")
                if not sni:
                    self._send_json({"error": domain_info.get("error") or "دامنه/SNI مشخص نیست — ابتدا توکن یا دامنه دستی را تنظیم کنید", "needs_token": True}, 400)
                    return
                futures = [
                    SCAN_EXECUTOR.submit(sni_handshake, p["ip"], port, sni)
                    for p in targets
                    for port in SNI_PORTS
                ]
                results = [f.result() for f in futures]
                results.sort(key=lambda r: (not r["success"], r.get("ping", 999999)))
                self._send_json({"results": results, "sni": sni, "sni_source": domain_info.get("source")})
                return

            futures = [
                SCAN_EXECUTOR.submit(socks4_handshake, p["ip"], p["port"])
                for p in targets
            ]
            results = [f.result() for f in futures]
            results.sort(key=lambda r: (not r["success"], r.get("ping", 999999)))
            self._send_json({"results": results})
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), ScannerHandler)
    print("==========================================")
    print("  Clean-IP Scanner (own servers only) — RUNNING")
    print(f"  Open: http://127.0.0.1:{PORT}/")
    print(f"  Sources: {', '.join(sorted(ALLOWED_FILES))} (فقط فایل‌های مجاز)")
    print(f"  SNI ports (mode=sni): {SNI_PORTS}")
    print("==========================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
