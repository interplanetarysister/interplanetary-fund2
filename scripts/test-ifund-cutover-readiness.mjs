import assert from "node:assert/strict";
import gateway from "../host/gateway/worker.js";

const base = "https://interplanetary-fund2.interplanetary-fund.workers.dev";
const env = {
  IFUND_SESSION_SECRET: "should-not-appear-in-readiness",
  IFUND_SERVICE_TOKEN: "should-not-appear-in-readiness"
};

const readiness = await gateway.fetch(new Request(base + "/api/health/readiness"), env);
assert.equal(readiness.status, 503, "Base44-dependent backend must fail independent readiness");
assert.equal(readiness.headers.get("cache-control"), "no-store");
const body = await readiness.json();
assert.equal(body.ready, false);
assert.equal(body.independent_backend, false);
assert.deepEqual(body.blockers, [
  "base44_mcp_proxy",
  "base44_auth_authority",
  "base44_campaign_authority"
]);
assert.ok(!JSON.stringify(body).includes(env.IFUND_SESSION_SECRET));
assert.ok(!JSON.stringify(body).includes(env.IFUND_SERVICE_TOKEN));

const invalidMethod = await gateway.fetch(
  new Request(base + "/api/health/readiness", { method: "POST" }), env
);
assert.equal(invalidMethod.status, 405);

const liveness = await gateway.fetch(new Request(base + "/api/health"), env);
assert.equal(liveness.status, 200, "Worker process liveness is distinct from migration readiness");
assert.equal((await liveness.json()).mcp_proxy, "base44");

console.log("PASS: Worker liveness stays available while independent-cutover readiness fails closed.");
