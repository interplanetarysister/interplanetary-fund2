import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const verifier = path.join(root, "scripts/verify-notificationbell-runtime-contract.mjs");
const sourcePath = path.join(root, "src/components/NotificationBell.jsx");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "notificationbell-contract-"));

function runVerifier(fixturePath) {
  return spawnSync(process.execPath, [verifier], {
    cwd: root,
    env: { ...process.env, NOTIFICATIONBELL_SOURCE_PATH: fixturePath },
    encoding: "utf8",
  });
}

try {
  const source = fs.readFileSync(sourcePath, "utf8");
  const validFixture = path.join(tempDir, "valid.jsx");
  const invalidRouteFixture = path.join(tempDir, "invalid-route.jsx");
  const invalidStatusIdFixture = path.join(tempDir, "invalid-status-id.jsx");
  fs.writeFileSync(validFixture, source, "utf8");
  fs.writeFileSync(
    invalidRouteFixture,
    `${source}\n<Link to="/inbox">legacy inbox fixture</Link>\n`,
    "utf8",
  );
  fs.writeFileSync(
    invalidStatusIdFixture,
    source
      .replace(/const statusId = `notification-bell-status-\$\{useId\(\)\.replace\(\/\\:\/g, \"\"\)\}`;/, 'const statusId = "notification-bell-status";')
      .replace(/\["instance-unique status id", \/\\buseId\\s\*\\(\)\/\],/, '["instance-unique status id", /\\buseId\\s*\\(/],'),
    "utf8",
  );

  const valid = runVerifier(validFixture);
  assert.equal(valid.status, 0, `valid fixture should pass: ${valid.stderr}`);

  const invalidRoute = runVerifier(invalidRouteFixture);
  assert.notEqual(invalidRoute.status, 0, "invalid route fixture must fail the contract verifier");
  assert.match(invalidRoute.stderr, /generic inbox route/);

  const invalidStatusId = runVerifier(invalidStatusIdFixture);
  assert.notEqual(invalidStatusId.status, 0, "fixed status-id fixture must fail the contract verifier");
  assert.match(invalidStatusId.stderr, /non-unique status id|instance-unique status id/);

  console.log("NotificationBell runtime contract negative-case tests passed");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
