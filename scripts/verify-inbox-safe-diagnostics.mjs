import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/Inbox.jsx", import.meta.url), "utf8");

const required = [
  'const INBOX_LOAD_ERROR = "We couldn\'t load your inbox. Please try again.";',
  "useRef",
  "generationRef.current = generation",
  "loadGenerationIsCurrent(generationRef, generation)",
  "catch {",
  "setError(INBOX_LOAD_ERROR)",
  "return () => {",
  "active = false;",
  "Array.isArray(r.data.donations)",
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Inbox verifier failed: missing ${marker}`);
  }
}

if (/e\\.message|error\\.message/.test(source)) {
  throw new Error("Inbox verifier failed: raw exception message access remains");
}

console.log("Inbox safe diagnostics and stale-load source contracts passed.");
