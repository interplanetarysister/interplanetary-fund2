import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = fs.readFileSync(path.join(root, "src", "components", "account", "AccountManagement.jsx"), "utf8");

const failures = [];

if (!/PlatformConnection\.filter\(\{\s*created_by_id:\s*me\.id\s*\}/.test(target)) {
  failures.push("account export must bind PlatformConnection reads to the authenticated user's created_by_id");
}

if (!/const exportSafeConnections = connections\.map\(\(\{\s*id,\s*created_by_id,\s*created_date,\s*updated_date,\s*platform,\s*kind,\s*display_name,\s*external_url,\s*campaign_id,\s*status,\s*automation_mode,\s*external_total,\s*external_donor_count,\s*last_synced\s*\}\)\s*=>/.test(target)) {
  failures.push("account export must use an explicit allowlisted PlatformConnection projection");
}

if (/credentials|history|last_error/.test(target.match(/const exportSafeConnections = connections\.map\([\s\S]*?\n\s*\}\);/)?.[0] || "")) {
  failures.push("export-safe PlatformConnection projection must exclude credentials, history, and last_error");
}

if (/PlatformConnection\.list\(/.test(target)) {
  failures.push("account export must not use an unscoped PlatformConnection.list call");
}

const payloadMatch = target.match(/const payload = \{[\s\S]*?\n\s*\};/);
if (!payloadMatch || !/connections:\s*exportSafeConnections/.test(payloadMatch[0])) {
  failures.push("downloaded payload must use the export-safe connection projection");
}

if (failures.length) {
  console.error("Account export privacy guard FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Account export privacy guard passed.");
