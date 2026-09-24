import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const auditScript = path.join(root, "scripts/audit-dependency-router-drift.mjs");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "if-dependency-router-audit-"));

function writeFixture(name, { routerRange = "^7.18.4", routerResolved = "7.18.4", source }) {
  const fixture = path.join(tempRoot, name);
  fs.mkdirSync(path.join(fixture, "src"), { recursive: true });
  fs.writeFileSync(path.join(fixture, "package.json"), JSON.stringify({
    type: "module",
    dependencies: {
      fflate: "^0.8.3",
      "react-router-dom": routerRange,
    },
  }, null, 2));
  fs.writeFileSync(path.join(fixture, "package-lock.json"), JSON.stringify({
    lockfileVersion: 3,
    packages: {
      "": {
        dependencies: {
          fflate: { version: "0.8.3" },
          "react-router-dom": { version: routerResolved },
        },
      },
    },
  }, null, 2));
  fs.writeFileSync(path.join(fixture, "src", "fixture.jsx"), source);
  return fixture;
}

function run(fixture) {
  return spawnSync(process.execPath, [auditScript], {
    cwd: fixture,
    encoding: "utf8",
  });
}

function assertPass(name, result) {
  if (result.status !== 0) {
    throw new Error(`${name} expected pass, got ${result.status}: ${result.stderr}`);
  }
}

function assertFail(name, result, code) {
  if (result.status === 0 || !result.stderr.includes(code)) {
    throw new Error(`${name} expected ${code}, got ${result.status}: ${result.stderr}`);
  }
}

try {
  const commentedOnly = writeFixture("commented-only", {
    source: `// import "react-quill";\nimport { zipSync } from "fflate";\nimport { BrowserRouter } from "react-router-dom";\n`,
  });
  assertPass("commented-only", run(commentedOnly));

  const reExport = writeFixture("re-export", {
    source: `export { default as Quill } from "react-quill";\nimport { zipSync } from "fflate";\nimport { BrowserRouter } from "react-router-dom";\n`,
  });
  assertFail("re-export", run(reExport), "REMOVED_DEPENDENCY_STILL_IMPORTED");

  const separatedImport = writeFixture("comment-separated-import", {
    source: `import /* separated */ "react-quill";\nimport { zipSync } from "fflate";\nimport { BrowserRouter } from "react-router-dom";\n`,
  });
  assertFail("comment-separated-import", run(separatedImport), "REMOVED_DEPENDENCY_STILL_IMPORTED");

  const localSwitch = writeFixture("local-switch", {
    source: `import { Switch } from "./components/ui/switch.jsx";\nimport { BrowserRouter } from "react-router-dom";\nimport { zipSync } from "fflate";\n`,
  });
  assertPass("local-switch", run(localSwitch));

  const resolvedRouterV7 = writeFixture("resolved-router-v7", {
    routerRange: ">=6 <8",
    routerResolved: "7.18.4",
    source: `import { Switch } from "react-router-dom";\nimport { zipSync } from "fflate";\n`,
  });
  assertFail("resolved-router-v7", run(resolvedRouterV7), "ROUTER_V7_LEGACY_API_USAGE");

  const resolvedRouterV6 = writeFixture("resolved-router-v6", {
    routerRange: "^5.3.0 || ^7.0.0",
    routerResolved: "6.30.1",
    source: `import { Switch } from "react-router-dom";\nimport { zipSync } from "fflate";\n`,
  });
  assertPass("resolved-router-v6", run(resolvedRouterV6));

  console.log("audit-dependency-router-drift fixtures: PASS");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
