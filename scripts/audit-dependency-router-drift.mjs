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

function stripJsComments(source) {
  let output = "";
  let state = "code";
  let quote = "";
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (state === "line-comment") {
      if (char === "\n") { state = "code"; output += "\n"; }
      continue;
    }
    if (state === "block-comment") {
      if (char === "*" && next === "/") { state = "code"; index += 1; output += " "; }
      else if (char === "\n") output += "\n";
      continue;
    }
    if (state === "string") {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) state = "code";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      state = "string"; quote = char; escaped = false; output += char; continue;
    }
    if (char === "/" && next === "/") { state = "line-comment"; index += 1; continue; }
    if (char === "/" && next === "*") { state = "block-comment"; index += 1; continue; }
    output += char;
  }
  return output;
}

function hasExecutableImport(source, packageName) {
  const normalized = stripJsComments(source);
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const staticImport = new RegExp(`(?:^|\\n)\\s*(?:import|export)(?:[^;\\n]*?\\s+from\\s+|\\s*)[\\\"']${escaped}[\\\"']`, "m");
  const dynamicImport = new RegExp(`\\bimport\\s*\\(\\s*[\\\"']${escaped}[\\\"']\\s*\\)`);
  const requireImport = new RegExp(`\\brequire\\s*\\(\\s*[\\\"']${escaped}[\\\"']\\s*\\)`);
  return staticImport.test(normalized) || dynamicImport.test(normalized) || requireImport.test(normalized);
}

function routerUsesLegacyApi(source) {
  const normalized = stripJsComments(source);
  const importFromRouter = /(?:^|\n)\s*import\s+([\s\S]*?)\s+from\s+["']react-router-dom["']/g;
  for (const match of normalized.matchAll(importFromRouter)) {
    if (/\bSwitch\b|\buseHistory\b/.test(match[1])) return true;
  }
  const requireFromRouter = /\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*["']react-router-dom["']\s*\)/g;
  for (const match of normalized.matchAll(requireFromRouter)) {
    if (/\bSwitch\b|\buseHistory\b/.test(match[1])) return true;
  }
  return false;
}

function selectsRouterV7(version) {
  const normalized = String(version ?? "").trim();
  if (!/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(normalized)) {
    fail("LOCKFILE_RESOLVED_VERSION_INVALID", `react-router-dom=${normalized || "<empty>"}`);
  }
  return normalized.startsWith("7.");
}

const pkg = readJson(packagePath, "PACKAGE_JSON_UNREADABLE");
const lock = readJson(packageLockPath, "PACKAGE_LOCK_UNREADABLE");
const dependencies = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
const lockRoot = lock.packages?.[""] ?? {};

for (const name of ["fflate", "react-router-dom"]) {
  if (!dependencies[name]) fail("DECLARED_DEPENDENCY_MISSING", name);
  if (!lockRoot.dependencies?.[name]) fail("LOCKFILE_ROOT_DEPENDENCY_MISSING", name);
  if (!lockRoot.dependencies[name].version) fail("LOCKFILE_RESOLVED_VERSION_MISSING", name);
}

const files = walk(srcRoot);
const entries = files.map((file) => ({ file, text: fs.readFileSync(file, "utf8") }));
const fflateImport = entries.some(({ text }) => hasExecutableImport(text, "fflate"));
const reactRouterImport = entries.some(({ text }) => hasExecutableImport(text, "react-router-dom"));
const reactQuillImport = entries.some(({ text }) => hasExecutableImport(text, "react-quill"));
const routerLegacyFiles = entries.filter(({ text }) => routerUsesLegacyApi(text)).map(({ file }) => path.relative(root, file));

if (!fflateImport) fail("DECLARED_DEPENDENCY_NO_SOURCE_IMPORT", "fflate");
if (!reactRouterImport) fail("DECLARED_DEPENDENCY_NO_SOURCE_IMPORT", "react-router-dom");
if (reactQuillImport) fail("REMOVED_DEPENDENCY_STILL_IMPORTED", "react-quill");

const resolvedFflateVersion = lockRoot.dependencies.fflate.version;
const resolvedRouterVersion = lockRoot.dependencies["react-router-dom"].version;
const routerV7 = selectsRouterV7(resolvedRouterVersion);
const routerV7LegacyApi = routerLegacyFiles.length > 0;
if (routerV7 && routerV7LegacyApi) {
  fail("ROUTER_V7_LEGACY_API_USAGE", routerLegacyFiles.join(", "));
}

console.log(JSON.stringify({
  status: "pass",
  declared: {
    fflate: dependencies.fflate,
    reactRouterDom: dependencies["react-router-dom"],
    reactQuill: dependencies["react-quill"] ?? null,
  },
  resolved: {
    fflate: resolvedFflateVersion,
    reactRouterDom: resolvedRouterVersion,
  },
  evidence: {
    sourceFilesScanned: files.length,
    fflateImport,
    reactRouterImport,
    reactQuillImport,
    routerV7,
    routerV7LegacyApi,
    routerLegacyFiles,
  },
}, null, 2));
