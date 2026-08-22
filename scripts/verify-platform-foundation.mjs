import assert from "node:assert/strict";
import {
  PLATFORM_FOUNDATION,
  createIdempotencyKey,
  createPlatformEvent,
  sanitizePlatformError,
  withRetry,
} from "../src/lib/platform/foundationContracts.js";

const event = createPlatformEvent({
  name: "platform.health_check.executed",
  actorId: "verification-user",
  resourceType: "platform",
  resourceId: "all-operating-systems",
  idempotencyKey: createIdempotencyKey("verify", "platform-foundation"),
  payload: { status: "ok" },
});

assert.equal(event.version, PLATFORM_FOUNDATION.eventVersion);
assert.equal(event.payload.status, "ok");
assert.match(event.idempotency_key, /^verify:platform-foundation$/);

assert.throws(
  () => createPlatformEvent({
    name: "arbitrary.unregistered.event",
    actorId: "user",
    resourceType: "platform",
    resourceId: "resource",
    idempotencyKey: "test:1",
  }),
  /Unsupported platform event/,
);

assert.equal(
  sanitizePlatformError(new Error("https://provider.example/private-token?query=secret")),
  "The service is temporarily unavailable",
);
assert.equal(
  sanitizePlatformError({ code: "HEALTH_CHECK_TIMEOUT" }),
  "Dependency timed out",
);
assert.throws(() => withRetry(async () => "ok"), /idempotencyKey/);
assert.throws(
  () => createPlatformEvent({
    name: "platform.health_check.executed",
    actorId: "user",
    resourceType: "platform",
    resourceId: "resource",
    idempotencyKey: "test:2",
    payload: "invalid",
  }),
  /payload must be an object/,
);

let attempts = 0;
const result = await withRetry(
  async ({ attempt, idempotencyKey }) => {
    attempts = attempt;
    assert.equal(idempotencyKey, "verify:retry");
    if (attempt < 2) throw new Error("transient");
    return "success";
  },
  { idempotencyKey: "verify:retry", backoffMs: 0 },
);
assert.equal(result, "success");
assert.equal(attempts, 2);

console.log("Platform foundation verification passed.");
