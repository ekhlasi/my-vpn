"""
Clean-IP Scanner — دو مرحله‌ای، جهت درست
=============================================================
مکانیزم عمداً یک‌طرفه است و نباید برعکس شود:

  مرحله ۱ (کشف):  از طریق یکی از پروکسی‌های SOCKS4 شما (proxy/*.txt) یک
                   کوئری DoH به سمت دامنه ورکر/پنل شما زده می‌شود. چون
                   کوئری از داخل شبکه‌ی کشور آن پروکسی خارج می‌شود،
                   جواب DNS، آی‌پی edge کلادفلر مخصوص همان مسیر شبکه را
                   برمی‌گرداند — این‌ها «کاندیدهای سالم» هستند.

  مرحله ۲ (اعتبارسنجی): این کاندیدها با هندشیک TLS/SNI مستقیم، از روی
                   همین سروری که این اسکریپت را اجرا می‌کنید (یعنی نتِ
                   خودتان، بدون هیچ پروکسی‌ای) تست می‌شوند تا ببینیم
                   واقعاً برای شما هم قابل‌دسترسی/پینگ‌پذیر هستند یا نه.

این جهت را عوض نکنید: پروکسی فقط برای «کشف» است، اعتبارسنجی نهایی همیشه
باید از نتِ خودِ کاربر باشد، چون آن چیزی‌ست که در عمل استفاده می‌شود.

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
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from concurrent.futures import ThreadPoolExecutor

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IPS_FILE = os.path.join(BASE_DIR, "ips.txt")
PROXY_DIR = os.path.join(BASE_DIR, "proxy")
ALLOWED_PROXY_FILES = {"de.txt", "tr.txt", "ru.txt", "az.txt", "uae.txt"}
MAX_PROXIES_PER_COUNTRY = 25  # سقف تعداد پروکسی امتحان‌شده در هر کشور، برای جلوگیری از کند شدن بیش از حد

SCAN_EXECUTOR = ThreadPoolExecutor(max_workers=100)

# --- مرحله ۲: اعتبارسنجی مستقیم از نت خودتان (بدون پروکسی) ---
SCAN_PORT = 443
SCAN_PASSES = 3
SCAN_TIMEOUT = 3.5

# --- مرحله ۱: کشف از طریق پروکسی، با یک DoH query به سمت دامنه‌ی SNI ---
DOH_IP = "1.1.1.1"          # آی‌پی ثابت DoH کلادفلر — نیازی به resolve دامنه نیست
DOH_PORT = 443
DOH_SNI = "cloudflare-dns.com"
DISCOVER_TIMEOUT = 6.0


def scan_ip(ip, target_sni, timeout=SCAN_TIMEOUT):
    """مرحله ۲: هندشیک TLS مستقیم (بدون پروکسی) روی پورت 443، ۳ بار تکرار،
    میانگین پینگ تلاش‌های موفق."""
    successful_pings = []
    last_error = "failed"
    for _ in range(SCAN_PASSES):
        start_time = time.time()
        try:
            with socket.create_connection((ip, SCAN_PORT), timeout=timeout) as sock:
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                with context.wrap_socket(sock, server_hostname=target_sni) as ssock:
                    req = (
                        f"GET / HTTP/1.1\r\nHost: {target_sni}\r\n"
                        f"User-Agent: clean-ip-scanner\r\nConnection: close\r\n\r\n"
                    )
                    ssock.sendall(req.encode("ascii"))
                    resp = ssock.recv(2048)
                    if resp.startswith(b"HTTP/1."):
                        ping_ms = int((time.time() - start_time) * 1000)
                        successful_pings.append(ping_ms)
        except Exception as e:
            last_error = str(e)

    if successful_pings:
        avg_ping = sum(successful_pings) // len(successful_pings)
        return {"ip": ip, "success": True, "ping": avg_ping}
    return {"ip": ip, "success": False, "error": last_error}


def _socks4_connect(proxy_ip, proxy_port, dest_ip, dest_port, timeout):
    """یک اتصال SOCKS4 CONNECT واقعی به proxy می‌زند و در صورت پذیرفته شدن،
    سوکت خام (تونل‌شده تا dest_ip:dest_port) را برمی‌گرداند."""
    sock = socket.create_connection((proxy_ip, proxy_port), timeout=timeout)
    try:
        dest_packed = socket.inet_aton(dest_ip)
        packet = struct.pack("!BBH", 0x04, 0x01, dest_port) + dest_packed + b"\x00"
        sock.sendall(packet)
        resp = sock.recv(8)
        if len(resp) < 2 or resp[1] != 0x5A:
            code = resp[1] if len(resp) > 1 else "?"
            raise ConnectionError(f"SOCKS4 CONNECT rejected (code {code})")
        return sock
    except Exception:
        sock.close()
        raise


def _read_http_response(ssock, timeout=DISCOVER_TIMEOUT):
    ssock.settimeout(timeout)
    chunks = []
    try:
        while True:
            data = ssock.recv(4096)
            if not data:
                break
            chunks.append(data)
    except Exception:
        pass
    return b"".join(chunks)


def _extract_json_body(raw):
    idx = raw.find(b"\r\n\r\n")
    if idx == -1:
        raise ValueError("پاسخ HTTP نامعتبر بود")
    header = raw[:idx].decode("latin-1", errors="ignore")
    body = raw[idx + 4:]
    if "transfer-encoding: chunked" in header.lower():
        out = b""
        while body:
            nl = body.find(b"\r\n")
            if nl == -1:
                break
            try:
                size = int(body[:nl], 16)
            except ValueError:
                break
            if size == 0:
                break
            out += body[nl + 2: nl + 2 + size]
            body = body[nl + 2 + size + 2:]
        body = out
    return json.loads(body.decode("utf-8", errors="ignore"))


def discover_via_proxy(proxy_ip, proxy_port, country, target_sni, timeout=DISCOVER_TIMEOUT):
    """مرحله ۱: یک DoH query (نوع A) به target_sni، تونل‌شده از طریق پروکسی
    SOCKS4 شما — نتیجه: آی‌پی(های) edge کلادفلری که آن مسیر شبکه به آن‌ها
    می‌رسد."""
    try:
        raw_sock = _socks4_connect(proxy_ip, proxy_port, DOH_IP, DOH_PORT, timeout)
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        with context.wrap_socket(raw_sock, server_hostname=DOH_SNI) as ssock:
            path = f"/dns-query?name={urllib.parse.quote(target_sni)}&type=A"
            req = (
                f"GET {path} HTTP/1.1\r\nHost: {DOH_SNI}\r\n"
                f"Accept: application/dns-json\r\nConnection: close\r\n\r\n"
            )
            ssock.sendall(req.encode("ascii"))
            raw = _read_http_response(ssock, timeout)
        data = _extract_json_body(raw)
        answers = data.get("Answer", []) or []
        candidates = [a["data"] for a in answers if a.get("type") == 1 and a.get("data")]
        candidates = list(dict.fromkeys(candidates))  # dedup ordered
        return {
            "proxy": f"{proxy_ip}:{proxy_port}",
            "country": country,
            "success": bool(candidates),
            "candidates": candidates,
        }
    except Exception as e:
        return {
            "proxy": f"{proxy_ip}:{proxy_port}",
            "country": country,
            "success": False,
            "candidates": [],
            "error": str(e),
        }


def load_socks4_proxies(country):
    """فقط خطوط socks4:// را از فایل(های) مجاز می‌خواند (socks5/http برای
    این تونل SOCKS4 قابل استفاده نیستند)، حداکثر MAX_PROXIES_PER_COUNTRY
    مورد در هر کشور."""
    country = (country or "ALL").upper()
    files = sorted(ALLOWED_PROXY_FILES) if country == "ALL" else [f"{country.lower()}.txt"]
    out = []
    for fname in files:
        if fname not in ALLOWED_PROXY_FILES:
            continue
        fpath = os.path.join(PROXY_DIR, fname)
        if not os.path.isfile(fpath):
            continue
        cc = fname.replace(".txt", "").upper()
        count = 0
        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line.lower().startswith("socks4://"):
                    continue
                uri = line[len("socks4://"):]
                if ":" not in uri:
                    continue
                ip, port_str = uri.rsplit(":", 1)
                try:
                    port = int(port_str)
                except ValueError:
                    continue
                out.append({"ip": ip, "port": port, "country": cc})
                count += 1
                if count >= MAX_PROXIES_PER_COUNTRY:
                    break
    return out


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

        if self.path.startswith("/ips.txt"):
            try:
                with open(IPS_FILE, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-type", "text/plain; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/discover":
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length) or b"{}")
                sni = (data.get("sni") or "").strip()
                country = (data.get("country") or "ALL").upper()
                if not sni:
                    self._send_json({"error": "دامنه/SNI مشخص نیست"}, 400)
                    return
                proxies = load_socks4_proxies(country)
                if not proxies:
                    self._send_json({"error": f"هیچ پروکسی SOCKS4‌ای برای {country} پیدا نشد", "candidates": [], "details": []}, 200)
                    return
                futures = [
                    SCAN_EXECUTOR.submit(discover_via_proxy, p["ip"], p["port"], p["country"], sni)
                    for p in proxies
                ]
                details = [f.result() for f in futures]
                candidates = []
                for d in details:
                    for ip in d.get("candidates", []):
                        if ip not in candidates:
                            candidates.append(ip)
                self._send_json({"candidates": candidates, "details": details})
            except Exception as e:
                print(f"[CRASH PREVENTED] /api/discover error: {e}")
                self._send_json({"error": str(e)}, 500)
            return

        if self.path == "/api/scan":
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length) or b"{}")
                ips = data.get("ips", [])
                sni = data.get("sni", "")
                results = []
                if ips and sni:
                    futures = [SCAN_EXECUTOR.submit(scan_ip, ip, sni) for ip in ips]
                    results = [f.result() for f in futures]
                self._send_json({"results": results})
            except Exception as e:
                print(f"[CRASH PREVENTED] /api/scan error: {e}")
                self._send_json({"error": str(e)}, 500)
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), ScannerHandler)
    print("==========================================")
    print("  Clean-IP Scanner (proxy-discover -> my-net validate) — RUNNING")
    print(f"  Open: http://127.0.0.1:{PORT}/")
    print(f"  Discovery: SOCKS4 proxy -> DoH query -> candidate CF edge IPs")
    print(f"  Validation: direct TLS/SNI from this machine, port {SCAN_PORT}, {SCAN_PASSES} passes")
    print("==========================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
