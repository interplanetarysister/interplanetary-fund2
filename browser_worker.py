"""Signed, read-only HTTP endpoint for the Python browser connection tool.

Run behind HTTPS/private ingress. Configuration and session mappings are
server-side secrets, never values supplied in an agent prompt or HTTP request.
No Browserbase session is created unless the owner has a configured context.
"""

import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import time

from browser_integration import BrowserAction, BrowserConnectionTool, SiteHandler


def settings_json(name: str) -> dict:
    value = json.loads(os.environ.get(name, "{}"))
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    return value


def build_tool() -> BrowserConnectionTool:
    sites = settings_json("BROWSER_SITE_CONFIG_JSON")
    contexts = settings_json("BROWSER_CONTEXTS_JSON")
    handlers = {}
    for platform, spec in sites.items():
        host = spec.get("hostname")
        selectors = spec.get("metric_selectors")
        if not isinstance(host, str) or not isinstance(selectors, dict) or not selectors:
            raise ValueError("Each configured site needs a hostname and metric selectors")
        # Selectors come from trusted worker configuration, not agent requests.
        def read_metrics(page, fields=selectors):
            return {name: page.locator(selector).first.inner_text(timeout=5000)[:500]
                    for name, selector in fields.items()}
        handlers[platform] = SiteHandler(host, {"GET_METRICS": read_metrics})

    return BrowserConnectionTool(
        handlers,
        context_for_owner=lambda owner, platform: contexts.get(owner, {}).get(platform),
    )


def verify_request(body: bytes, timestamp: str, signature: str, secret: str) -> bool:
    if len(body) > 8192 or not timestamp.isdigit() or abs(time.time() - int(timestamp)) > 60:
        return False
    expected = hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)


def make_handler(tool: BrowserConnectionTool, secret: str, sessions: dict):
    class Handler(BaseHTTPRequestHandler):
        def reply(self, code: int, data: dict):
            payload = json.dumps(data).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def do_POST(self):
            if self.path != "/observe":
                return self.reply(404, {"error": "Not found"})
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if size < 1 or size > 8192:
                    return self.reply(400, {"error": "Invalid request"})
                body = self.rfile.read(size)
                if not verify_request(body, self.headers.get("X-IF-Timestamp", ""),
                                      self.headers.get("X-IF-Signature", ""), secret):
                    return self.reply(401, {"error": "Unauthorized"})
                data = json.loads(body)
                if data.get("action") != "GET_METRICS":
                    return self.reply(400, {"error": "Unsupported action"})
                owner = data["owner_id"]
                platform = data["platform"]
                session_path = sessions.get(owner, {}).get(platform)
                request = BrowserAction(
                    platform=platform, resource_id=data["resource_id"], url=data["url"],
                    action="GET_METRICS", owner_id=owner, authorized_owner_id=owner,
                    granted_actions=frozenset({"GET_METRICS"}),
                    session_file=Path(session_path) if session_path else Path("/nonexistent-browser-session"),
                    allow_hosted_fallback=True,
                )
                result = tool.execute(request)
                return self.reply(200, result)
            except (KeyError, TypeError, ValueError):
                return self.reply(400, {"error": "Invalid connection request"})
            except Exception:
                # Never return session IDs, browser errors, API keys or page text in errors.
                return self.reply(502, {"error": "Browser observation unavailable"})

    return Handler


if __name__ == "__main__":
    signing_key = os.environ.get("BROWSER_WORKER_SIGNING_KEY", "")
    if len(signing_key) < 32:
        raise RuntimeError("A signing key of at least 32 characters is required")
    tool = build_tool()
    sessions = settings_json("BROWSER_LOCAL_SESSIONS_JSON")
    port = int(os.environ.get("PORT", "8080"))
    ThreadingHTTPServer(("0.0.0.0", port), make_handler(tool, signing_key, sessions)).serve_forever()
