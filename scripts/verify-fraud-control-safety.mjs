import fs from "node:fs";

const file = "src/components/platform/FraudControlPanel.jsx";
const source = fs.readFileSync(file, "utf8");

const required = [
  ["stable load error", "SAFE_LOAD_ERROR"],
  ["stable approval error", "SAFE_APPROVAL_ERROR"],
  ["stable denial error", "SAFE_DENIAL_ERROR"],
  ["stable freeze error", "SAFE_FREEZE_ERROR"],
  ["stable unfreeze error", "SAFE_UNFREEZE_ERROR"],
  ["mounted fencing", "mountedRef"],
  ["request-generation fencing", "generationRef"],
  ["duplicate-action guard", "busyRef"],
  ["malformed array rejection", "isArrayOfRecords"],
  ["server-boundary reminder", "server-side authorization remains authoritative"],
];

const missing = required.filter(([, token]) => !source.includes(token));
if (missing.length) {
  throw new Error(`Fraud control safety contract missing: ${missing.map(([label]) => label).join(", ")}`);
}

const forbidden = [
  "e.message",
  "catch (e) { msg(false, e.message",
  "catch(e) { msg(false, e.message",
];
const leaked = forbidden.filter((token) => source.includes(token));
if (leaked.length) {
  throw new Error(`Raw client error disclosure remains: ${leaked.join(", ")}`);
}

for (const [label, pattern] of [
  ["queue array validation", /if \(!isArrayOfRecords\(w\) \|\| !isArrayOfRecords\(c\)\)/],
  ["duplicate submission guard", /if \(busyRef\.current\.has\(key\)\) return;/],
  ["mounted stale-load guard", /!mountedRef\.current \|\| generation !== generationRef\.current/],
]) {
  if (!pattern.test(source)) throw new Error(`Fraud control safety contract missing: ${label}`);
}

console.log("Fraud control safety contract passed.");
