import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");

function fail(code) {
  console.error(code);
  process.exit(1);
}

function readJson(filePath, code) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    fail(code);
  }
}

const pkg = readJson(packagePath, "MALFORMED_PACKAGE_JSON");
const lock = readJson(lockPath, "MALFORMED_LOCKFILE_JSON");
const rootPackage = lock?.packages?.[""];
if (!rootPackage || typeof rootPackage !== "object") fail("MISSING_LOCKFILE_ROOT");

if (pkg.engines?.node !== "22.x") fail("PACKAGE_NODE_BASELINE_DRIFT");
if (rootPackage.engines?.node !== "22.x") fail("LOCKFILE_NODE_BASELINE_DRIFT");

for (const section of ["dependencies", "devDependencies"]) {
  const expected = pkg[section] ?? {};
  const actual = rootPackage[section] ?? {};
  for (const [name, version] of Object.entries(expected)) {
    if (actual[name] !== version) fail(`LOCKFILE_${section.toUpperCase()}_DRIFT`);
  }
}

console.log("LOCKFILE_CONTRACT_OK");
