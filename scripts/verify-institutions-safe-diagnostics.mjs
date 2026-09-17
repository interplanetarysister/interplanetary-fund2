import fs from "node:fs";

const source = fs.readFileSync("src/pages/Institutions.jsx", "utf8");

const required = [
  ["stable user-facing copy", /const SAFE_LOAD_ERROR = \"We couldn't load institutions\. Please try again\.\"/],
  ["safe catch boundary", /\.catch\(\(\) => setError\(SAFE_LOAD_ERROR\)\)/],
  ["retry resets state", /setInstitutions\(null\);/],
  ["retry reuses loader", /onRetry=\{loadInstitutions\}/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(source)) throw new Error(`Missing ${label}`);
}

if (/e\.message/.test(source)) throw new Error("Raw exception message remains in Institutions.jsx");

console.log("Institutions safe diagnostics contract passed");
