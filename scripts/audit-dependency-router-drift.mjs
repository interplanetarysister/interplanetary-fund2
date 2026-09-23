import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const packageLockPath = path.join(root, "package-lock.json");
const srcRoot = path.join(root, "src");

function fail(code, detail) {
  console.error(`${code}: ${detail}`);
  process.exit(1);
}

function readJson(filePath, code) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    fail(code, path.relative(root, filePath));
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (/\.(jsx?|tsx?|mjs|cjs)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

const pkg = readJson(packagePath, "PACKAGE_JSON_UNREADABLE");
const lock = readJson(packageLockPath, "PACKAGE_LOCK_UNREADABLE");
const dependencies = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
const lockRoot = lock.packages?.[""] ?? {};

for (const name of ["fflate", "react-router-dom"]) {
  if (!dependencies[name]) fail("DECLARED_DEPENDENCY_MISSING", name);
  if (!lockRoot.dependencies?.[name]) fail("LOCKFILE_ROOT_DEPENDENCY_MISSING", name);
}

const files = walk(srcRoot);
const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const fflateImport = /(?:from\s+["']fflate["']|import\s*\(\s*["']fflate["']\s*\)|require\(\s*["']fflate["']\s*\))/;
const routerImport = /(?:from\s+["']react-router-dom["']|import\s*\(\s*["']react-router-dom["']\s*\)|require\(\s*["']react-router-dom["']\s*\))/;

if (!fflateImport.test(source)) fail("DECLARED_DEPENDENCY_NO_SOURCE_IMPORT", "fflate");
if (!routerImport.test(source)) fail("DECLARED_DEPENDENCY_NO_SOURCE_IMPORT", "react-router-dom");

const forbiddenLegacyImport = /(?:from\s+["']react-quill["']|import\s*\(\s*["']react-quill["']\s*\)|require\(\s*["']react-quill["']\s*\))/;
if (forbiddenLegacyImport.test(source)) fail("REMOVED_DEPENDENCY_STILL_IMPORTED", "react-quill");

const routerV7 = String(dependencies["react-router-dom"]).startsWith("^7.");
const legacySwitch = /\bSwitch\b/;
const legacyHistory = /\buseHistory\b/;
if (routerV7 && (legacySwitch.test(source) || legacyHistory.test(source))) {
  fail("ROUTER_V7_LEGACY_API_USAGE", "Switch/useHistory");
}

console.log(JSON.stringify({
  status: "pass",
  declared: {
    fflate: dependencies.fflate,
    reactRouterDom: dependencies["react-router-dom"],
    reactQuill: dependencies["react-quill"] ?? null,
  },
  evidence: {
    sourceFilesScanned: files.length,
    fflateImport: true,
    reactRouterImport: true,
    reactQuillImport: false,
    routerV7LegacyApi: false,
  },
}, null, 2));
