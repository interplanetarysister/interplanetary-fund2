import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/Institutions.jsx", import.meta.url), "utf8");

const required = [
  ["stable safe error copy", 'const SAFE_INSTITUTIONS_ERROR = "We couldn\'t load institutions. Please try again.";'],
  ["array response validation", "if (!Array.isArray(value)) return null;"],
  ["row object validation", 'institution && typeof institution === "object"'],
  ["row id validation", 'typeof institution.id === "string"'],
  ["request generation fencing", "currentRequest === requestId.current"],
  ["mounted fencing", "mounted.current"],
  ["retry performs reload", "onRetry={loadInstitutions}"],
  ["accessible loading status", 'role="status"'],
  ["accessible loading announcement", 'aria-live="polite"'],
];

for (const [label, fragment] of required) {
  if (!source.includes(fragment)) throw new Error(`Missing ${label}: ${fragment}`);
}

const forbidden = [
  "e.message",
  "error.message",
  "err.message",
  "JSON.stringify(e)",
  "JSON.stringify(error)",
  "console.error(e)",
  "console.error(error)",
];

for (const fragment of forbidden) {
  if (source.includes(fragment)) throw new Error(`Unsafe diagnostic fragment present: ${fragment}`);
}

console.log("Institutions safe-error contract verified.");
