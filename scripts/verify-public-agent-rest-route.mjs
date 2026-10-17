// Run after Cloudflare DNS activation and Worker deployment.
// Verifies that the public REST route reaches the expected API handler.
// Never supply or log an API key in this unauthenticated smoke test.
const origin = process.env.IFUND_PUBLIC_ORIGIN || "https://interplanetaryfund.com";
const target = new URL("/api/v1/agent/campaigns", origin);
let response;
try {
  response = await fetch(target, {
    method: "GET",
    headers: { accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
  });
} catch (error) {
  console.error("API unreachable (check nameservers, Cloudflare zone status, proxy DNS, and TLS):", error.name);
  process.exitCode = 1;
}
if (response) {
  const type = response.headers.get("content-type") || "";
  const body = await response.text();
  let parsed;
  try { parsed = JSON.parse(body); } catch { /* Detect HTML fallback. */ }
  if (response.status === 401 && type.includes("application/json") && parsed?.error) {
    console.log("PASS: external agent read route returns JSON 401 without credentials.");
  } else {
    console.error("FAIL: expected JSON 401 without a key; received", response.status, type);
    console.error("Verify Worker route and binding configuration; do not log response bodies containing credentials.");
    process.exitCode = 1;
  }
}
