import assert from "node:assert/strict";

const endpoint = "https://tzehxfikoslihnclhxuz.supabase.co/functions/v1/ifund-admin-mailbox";
const expected = [
  "https://interplanetaryfund.com",
  "https://www.interplanetaryfund.com",
  "https://interplanetaryfund.base44.app",
  "https://interplanetary-fund2.interplanetary-fund.workers.dev",
];
const forbidden = "https://untrusted.invalid";
const strict = process.env.IFUND_EXPECT_MAILBOX_CORS_LIVE === "1";

async function preflight(origin) {
  const response = await fetch(endpoint, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "GET" },
    signal: AbortSignal.timeout(12000),
  });
  return { status: response.status, allowOrigin: response.headers.get("access-control-allow-origin") };
}

for (const origin of expected) {
  const result = await preflight(origin);
  if (strict) {
    assert.equal(result.status, 204, `Expected allowed preflight for ${origin}`);
    assert.equal(result.allowOrigin, origin, `Expected exact origin for ${origin}`);
  }
  console.log(`${origin}: HTTP ${result.status}, allow-origin=${result.allowOrigin || "(none)"}`);
}

const denied = await preflight(forbidden);
assert.equal(denied.status, 403, "Untrusted origin must be denied");
assert.notEqual(denied.allowOrigin, forbidden, "Never grant untrusted origin");

const unauthenticated = await fetch(endpoint, {
  headers: { Origin: expected[0] },
  signal: AbortSignal.timeout(12000),
});
assert.equal(unauthenticated.status, 401, "Mailbox must require authentication");
assert.equal(unauthenticated.headers.get("cache-control"), "no-store", "Mailbox must not cache private responses");
console.log("PASS: untrusted origins denied; unauthenticated mailbox denied; private response not cached.");
if (!strict) console.log("Live CORS acceptance is observational until IFUND_EXPECT_MAILBOX_CORS_LIVE=1.");
