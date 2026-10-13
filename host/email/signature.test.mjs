import { test } from "node:test";
import assert from "node:assert/strict";
import { mailboxAllowed, sha256Hex, signPayload } from "./signature.mjs";

test("mailbox routing fails closed and accepts exact authorized address only", () => {
  const recipients = "support@interplanetaryfund.com, info@interplanetaryfund.com";
  assert.equal(mailboxAllowed("SUPPORT@interplanetaryfund.com", recipients), true);
  assert.equal(mailboxAllowed("help@interplanetaryfund.com", recipients), false);
  assert.equal(mailboxAllowed("support@interplanetaryfund.com.evil.test", recipients), false);
  assert.equal(mailboxAllowed("support@@interplanetaryfund.com", recipients), false);
  assert.equal(mailboxAllowed("support@interplanetaryfund.com", ""), false);
});

test("body signing binds signature to timestamp and content", async () => {
  const secret = "a".repeat(48);
  const first = await signPayload('{"subject":"A"}', "1791930000000", secret);
  const repeat = await signPayload('{"subject":"A"}', "1791930000000", secret);
  const tampered = await signPayload('{"subject":"B"}', "1791930000000", secret);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, repeat);
  assert.notEqual(first, tampered);
  await assert.rejects(() => signPayload("{}", "1", "short"));
});

test("hash matches standard SHA-256", async () => {
  const digest = await sha256Hex(new TextEncoder().encode("abc"));
  assert.equal(digest, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
