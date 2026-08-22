import assert from "node:assert/strict";
import fs from "node:fs/promises";
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
await assert.rejects(() => withRetry(async () => "ok"), /idempotencyKey/);
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

// Backward-compatibility guard: new PlatformEvent metadata is optional at the
// schema level so historical records and legacy writers remain readable/writable.
const schemaText = await fs.readFile(new URL("../base44/entities/PlatformEvent.jsonc", import.meta.url), "utf8");
const schema = JSON.parse(schemaText);
assert.deepEqual(schema.required, ["action"]);
for (const field of ["event_id", "event_version", "correlation_id", "idempotency_key", "occurred_at"]) {
  assert.ok(schema.properties?.[field], `PlatformEvent schema is missing ${field}`);
}

// The current authoritative application writer must populate the new metadata.
const writerText = await fs.readFile(new URL("../src/components/platform/logPlatformEvent.js", import.meta.url), "utf8");
for (const field of ["event_id", "event_version", "correlation_id", "idempotency_key", "occurred_at"]) {
  assert.ok(writerText.includes(field), `PlatformEvent writer is missing ${field}`);
}

console.log("Platform foundation verification passed.");
