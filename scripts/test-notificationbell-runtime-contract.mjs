import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const verifier = path.join(root, "scripts/verify-notificationbell-runtime-contract.mjs");
const sourcePath = path.join(root, "src/components/NotificationBell.jsx");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "notificationbell-contract-"));

try {
  const source = fs.readFileSync(sourcePath, "utf8");
  const validFixture = path.join(tempDir, "valid.jsx");
  const invalidFixture = path.join(tempDir, "invalid.jsx");
  fs.writeFileSync(validFixture, source, "utf8");
  fs.writeFileSync(invalidFixture, source.replace('to="/notifications"', 'to="/inbox"'), "utf8");

  const valid = spawnSync(process.execPath, [verifier], {
    cwd: root,
    env: { ...process.env, NOTIFICATIONBELL_SOURCE_PATH: validFixture },
    encoding: "utf8",
  });
  assert.equal(valid.status, 0, `valid fixture should pass: ${valid.stderr}`);

  const invalid = spawnSync(process.execPath, [verifier], {
    cwd: root,
    env: { ...process.env, NOTIFICATIONBELL_SOURCE_PATH: invalidFixture },
    encoding: "utf8",
  });
  assert.notEqual(invalid.status, 0, "invalid fixture must fail the contract verifier");
  assert.match(invalid.stderr, /generic inbox route/);

  console.log("NotificationBell runtime contract negative-case test passed");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
