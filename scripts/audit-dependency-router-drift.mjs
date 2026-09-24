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

function hasExecutableImport(source, packageName) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const staticImport = new RegExp(
    `^\\s*import(?:[^;\\n]*?\\s+from\\s+|\\s*)[\\\"']${escaped}[\\\"']`,
    "m",
  );
  const dynamicImport = new RegExp(`\\bimport\\s*\\(\\s*[\\\"']${escaped}[\\\"']\\s*\\)`);
  const requireImport = new RegExp(`\\brequire\\s*\\(\\s*[\\\"']${escaped}[\\\"']\\s*\\)`);
  return staticImport.test(source) || dynamicImport.test(source) || requireImport.test(source);
}

function routerUsesLegacyApi(source) {
  const importFromRouter = /(^|\n)\s*import\s+([\s\S]*?)\s+from\s+["']react-router-dom["']/g;
  for (const match of source.matchAll(importFromRouter)) {
    const specifiers = match[2];
    if (/\bSwitch\b|\buseHistory\b/.test(specifiers)) return true;
  }
  const requireFromRouter = /\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*["']react-router-dom["']\s*\)/g;
  for (const match of source.matchAll(requireFromRouter)) {
    if (/\bSwitch\b|\buseHistory\b/.test(match[1])) return true;
  }
  return false;
}

function selectsRouterV7(range) {
  const normalized = String(range).trim();
  return /(?:^|[ <>=~^|])7(?:\.|$)/.test(normalized) && !/\b(?:<|<=)\s*7(?:\.|$)/.test(normalized);
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
const sources = files.map((file) => fs.readFileSync(file, "utf8"));
const source = sources.join("\n");

if (!sources.some((text) => hasExecutableImport(text, "fflate"))) {
  fail("DECLARED_DEPENDENCY_NO_SOURCE_IMPORT", "fflate");
}
if (!sources.some((text) => hasExecutableImport(text, "react-router-dom"))) {
  fail("DECLARED_DEPENDENCY_NO_SOURCE_IMPORT", "react-router-dom");
}

if (sources.some((text) => hasExecutableImport(text, "react-quill"))) {
  fail("REMOVED_DEPENDENCY_STILL_IMPORTED", "react-quill");
}

const routerV7 = selectsRouterV7(dependencies["react-router-dom"]);
if (routerV7 && routerUsesLegacyApi(source)) {
  fail("ROUTER_V7_LEGACY_API_USAGE", "Switch/useHistory imported from react-router-dom");
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
