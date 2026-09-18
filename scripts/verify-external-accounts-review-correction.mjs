import fs from "node:fs";

const path = "src/pages/ExternalAccounts.jsx";
const source = fs.readFileSync(path, "utf8");

const required = [
  "SAFE_EXTERNAL_ACCOUNTS_ERROR",
  "generationRef",
  "mountedRef",
  "readConnections",
  "readUniqueRows",
  "response contains duplicate ids",
  "return () =>",
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`missing required guard: ${token}`);
}

if (/e\.message|error\.message|String\(e\)/.test(source)) {
  throw new Error("raw exception disclosure remains in ExternalAccounts");
}
if (!source.includes("typeof item.id === \"string\"")) {
  throw new Error("row identity validation is missing");
}

console.log("ExternalAccounts review correction verifier passed");
