"""Browser transport for user-authorized connections without a usable API.

Site-specific behavior must be registered explicitly. A successful browser action
is an external observation, never evidence of funds held by Interplanetary Fund.
This module runs in a Python worker; Base44's Deno functions cannot import it.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

from playwright.sync_api import Error as PlaywrightError, Page, sync_playwright


@dataclass(frozen=True)
class BrowserAction:
    platform: str
    resource_id: str
    url: str
    action: str
    owner_id: str
    authorized_owner_id: str
    granted_actions: frozenset[str]
    session_file: Path
    allow_hosted_fallback: bool = False


@dataclass(frozen=True)
class SiteHandler:
    hostname: str
    actions: dict[str, Callable[[Page], dict[str, Any]]]


class BrowserConnectionTool:
    def __init__(self, handlers: dict[str, SiteHandler],
                 context_for_owner: Callable[[str, str], str | None] | None = None):
        self.handlers = handlers
        # Resolve the Browserbase context server-side. Never accept a context ID
        # from an agent instruction or untrusted browser-action request.
        self.context_for_owner = context_for_owner
        self.cache: dict[tuple[str, str, str, str], tuple[datetime, dict[str, Any]]] = {}

    def execute(self, request: BrowserAction, *, max_age: timedelta | None = None) -> dict[str, Any]:
        handler = self.handlers.get(request.platform)
        if handler is None or request.action not in handler.actions:
            raise ValueError("No browser handler supports this platform and action")
        if not request.owner_id or request.owner_id != request.authorized_owner_id:
            raise PermissionError("Connection owner authorization is required")
        if request.action not in request.granted_actions:
            raise PermissionError("This browser action is not authorized")
        parsed = urlparse(request.url)
        host = (parsed.hostname or "").lower()
        allowed_host = handler.hostname.lower()
        if parsed.scheme != "https" or (host != allowed_host and not host.endswith("." + allowed_host)):
            raise ValueError("The destination does not match the registered platform")
        local_session = request.session_file.is_file()
        if not local_session and not request.allow_hosted_fallback:
            raise FileNotFoundError("An authorized browser session is required")

        key = (request.owner_id, request.platform, request.resource_id, request.action)
        now = datetime.now(timezone.utc)
        if request.action.startswith("GET_") and max_age is not None:
            cached = self.cache.get(key)
            if cached is not None and now - cached[0] < max_age:
                return {**cached[1], "cached": True}

        with sync_playwright() as playwright:
            browser = None
            hosted = False
            try:
                if local_session:
                    try:
                        browser = playwright.chromium.launch(headless=True)
                    except PlaywrightError:
                        if not request.allow_hosted_fallback:
                            raise
                if browser is None:
                    if not request.allow_hosted_fallback or self.context_for_owner is None:
                        raise RuntimeError("No authorized browser transport is available")
                    context_id = self.context_for_owner(request.owner_id, request.platform)
                    api_key = os.environ.get("BROWSERBASE_API_KEY")
                    if not context_id or not api_key:
                        raise RuntimeError("An authorized hosted browser context is not configured")
                    from browserbase import Browserbase
                    session = Browserbase(api_key=api_key).sessions.create(
                        browser_settings={"context": {"id": context_id, "persist": True}}
                    )
                    browser = playwright.chromium.connect_over_cdp(session.connect_url)
                    context = browser.contexts[0]
                    hosted = True
                else:
                    context = browser.new_context(storage_state=str(request.session_file))
                try:
                    page = context.new_page()
                    page.goto(request.url, wait_until="domcontentloaded")
                    # Redirects cannot move the authorized session to another site.
                    actual_host = (urlparse(page.url).hostname or "").lower()
                    if actual_host != allowed_host and not actual_host.endswith("." + allowed_host):
                        raise ValueError("The platform redirected outside its registered domain")
                    data = handler.actions[request.action](page)
                    if not isinstance(data, dict):
                        raise TypeError("A browser handler must return an observation dictionary")
                finally:
                    if not hosted:
                        context.close()
            finally:
                if browser is not None:
                    browser.close()

        result = {
            "status": "observed",
            "source": "authorized_browser_session",
            "external_only": True,
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "platform": request.platform,
            "resource_id": request.resource_id,
            "data": data,
            "cached": False,
        }
        if request.action.startswith("GET_") and max_age is not None:
            self.cache[key] = (now, result)
        return result
