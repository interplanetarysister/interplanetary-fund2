import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const termsSource = await readFile(new URL("../src/components/TermsAcceptance.jsx", import.meta.url), "utf8");

const forbiddenFragments = [
  "$50",
  "per claim",
  "Michelle Rogers is not liable",
  "personally liable for losses",
  "personal liability for losses",
];

const scanExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".md", ".mdx", ".html"]);
const excludedDirectories = new Set(["node_modules", ".git", "dist", "build"]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (excludedDirectories.has(entry.name)) continue;

    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else if (scanExtensions.has(extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

const sourceFiles = await collectFiles(sourceRoot);
const violations = [];

for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  const lowerSource = source.toLowerCase();

  for (const fragment of forbiddenFragments) {
    if (lowerSource.includes(fragment.toLowerCase())) {
      violations.push(`${file}: prohibited opening-agreement liability wording: ${fragment}`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Prohibited personal-liability wording found in source files:\n${violations.join("\n")}`);
}

for (const required of [
  "Campaign outcomes, donations, and third-party services may involve risks.",
  "Users are responsible for the campaigns, content, and actions they initiate through the platform.",
  "I Agree — Continue",
]) {
  if (!termsSource.includes(required)) {
    throw new Error(`Opening agreement is missing required corrected content: ${required}`);
  }
}

console.log(`Opening agreement liability verification passed; scanned ${sourceFiles.length} source files.`);
