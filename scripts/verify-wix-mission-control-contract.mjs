import fs from "node:fs";

const src = fs.readFileSync("base44/functions/syncWixMissionControl/entry.ts", "utf8");
const required = [
  "PUBLIC_CAMPAIGN_STATUSES",
  "interplanetaryfund.com/Campaign",
  "verification_status === 'verified'",
  "Wix synchronization failed.",
];
for (const marker of required) {
  if (!src.includes(marker)) throw new Error(`Wix mission-control contract missing: ${marker}`);
}
if (src.includes("interplanetaryfund.base44.app/Campaign")) {
  throw new Error("Wix public content must use the canonical IFund domain");
}
if (/detail:\s*text\(\(error/.test(src)) {
  throw new Error("Wix sync must not return raw provider diagnostics to clients");
}
if (src.includes("campaign.status !== 'draft'")) {
  throw new Error("Wix sync must use an explicit public-status allowlist");
}
console.log("Wix mission-control contract passed.");
