import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const remote = (process.env.IFUND_SMOKE_URL || "").trim().replace(new RegExp("/+$"), "");
const origin = remote || "http://127.0.0.1:4192";
let preview;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (!remote) {
  preview = spawn("./node_modules/.bin/vite", ["preview", "--host", "127.0.0.1", "--port", "4192", "--strictPort"], { cwd: process.cwd(), stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 45; i++) {
    if (preview.exitCode !== null) throw Error("Preview process stopped");
    try { if ((await fetch(origin)).ok) { up = true; break; } } catch {}
    await delay(250);
  }
  if (!up) throw Error("Mobile composer preview did not start");
}
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // A synthetic session is only for rendering a subscribed user's interface:
  // it cannot authorize an external account, payment, or provider request.
  await context.addInitScript(() => localStorage.setItem("base44_access_token", "ifund_mobile_layout_fixture"));
  await context.route("**/api/apps/public/prod/public-settings/by-id/**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ id: "6a67a778342a8fe05ee79cba", public_settings: "public_without_login" }),
  }));
  await context.route("**/api/apps/6a67a778342a8fe05ee79cba/entities/User/me", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ id: "layout-fixture", username: "Preview", role: "admin" }),
  }));
  const page = await context.newPage();
  const crashes = [];
  page.on("pageerror", (err) => crashes.push(err.message));
  await page.goto(origin + "/agents", { waitUntil: "domcontentloaded", timeout: 25000 });
  const agree = page.getByRole("button", { name: /I Agree — Continue/ });
  if (await agree.isVisible().catch(() => false)) await agree.click();
  const input = page.getByRole("textbox", { name: "Message Chief of Staff" });
  await input.waitFor({ state: "visible", timeout: 25000 });
  const geom = await page.evaluate(() => {
    const composer = document.querySelector("[data-ifund-chat-composer]");
    const textarea = composer?.querySelector("textarea");
    const nav = document.querySelector('nav[aria-label="Bottom navigation"]');
    const rect = textarea?.getBoundingClientRect(), navRect = nav?.getBoundingClientRect();
    return { position: composer ? getComputedStyle(composer).position : null, bodyRoot: composer?.parentElement === document.body,
      inputBottom: rect?.bottom, inputTop: rect?.top, navTop: navRect?.top, viewportHeight: innerHeight };
  });
  assert.equal(geom.position, "fixed", "Mobile composer must be fixed independently of scrolling page");
  assert.equal(geom.bodyRoot, true, "Mobile composer must be portaled outside clipped page containers");
  assert.ok(Number.isFinite(geom.inputBottom) && Number.isFinite(geom.navTop), "Composer and navigation must be rendered");
  assert.ok(geom.inputTop >= 0 && geom.inputBottom < geom.navTop, "Message field must be fully visible above the bottom nav: " + JSON.stringify(geom));
  assert.deepEqual(crashes, [], "No uncaught errors rendering mobile chat");
  console.log("PASS: mobile message entry is visible above bottom navigation:", JSON.stringify(geom));
  await context.close();
} finally {
  await browser?.close();
  if (preview) { preview.kill(); await delay(250); }
}
