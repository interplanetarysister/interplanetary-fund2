import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/components/TermsAcceptance.jsx");
const source = fs.readFileSync(file, "utf8");

const required = [
  ["initialization state", /useState\(false\)/],
  ["initialization completion", /setInitialized\(true\)/],
  ["storage read", /localStorage\.getItem\(TERMS_KEY\)/],
  ["storage failure fail-closed", /setAccepted\(false\)/],
  ["explicit button handler", /onClick=\{accept\}/],
  ["explicit button type", /type=\"button\"/],
  ["initialization gate", /if \(!initialized\) return null;/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(source)) {
    throw new Error(`TermsAcceptance contract missing: ${label}`);
  }
}

const forbidden = [
  ["timeout dismissal", /setTimeout\([^\n]*setAccepted/],
  ["backdrop dismissal", /onClick=\{[^}]*setAccepted\(true\)/],
  ["implicit navigation dismissal", /useEffect\([^)]*setAccepted\(true\)/s],
];

for (const [label, pattern] of forbidden) {
  if (pattern.test(source)) {
    throw new Error(`TermsAcceptance contract violation: ${label}`);
  }
}

console.log("TermsAcceptance explicit-click contract passed");
