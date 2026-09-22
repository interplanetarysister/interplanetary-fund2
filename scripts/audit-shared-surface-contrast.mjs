import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const auditedFiles = [
  "src/pages/Help.jsx",
  "src/pages/Discover.jsx",
  "src/pages/Subscriptions.jsx",
  "src/pages/EmbedCampaign.jsx",
  "src/pages/Institutions.jsx",
  "src/pages/Community.jsx",
  "src/components/LegalFooter.jsx",
  "src/components/NotificationBell.jsx",
  "src/components/giving/DonationRow.jsx",
  "src/components/dashboard/StatCard.jsx",
  "src/components/analytics/ReportCard.jsx",
  "src/components/comms/MessageHistory.jsx",
  "src/components/connections/ConnectionCard.jsx",
  "src/components/admin/ExternalAccountsTable.jsx",
  "src/components/campaigns/DonateDialog.jsx",
];

const authoritativeRoots = ["src/pages", "src/components"];
const tokenPattern = /text-stone-(400|500|600|700|800|900)/g;
const auditedSet = new Set(auditedFiles);
const findings = [];
const omittedCandidates = [];

function walk(relativeDir) {
  const absoluteDir = path.join(repoRoot, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return walk(relativePath);
    return /\.(jsx?|tsx?)$/.test(entry.name) ? [relativePath] : [];
  });
}

for (const relativePath of auditedFiles) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Missing audited file: ${relativePath}`);
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(tokenPattern)) {
      findings.push({ file: relativePath, line: index + 1, token: match[0], text: line.trim() });
    }
  });
}

for (const relativePath of authoritativeRoots.flatMap(walk)) {
  if (auditedSet.has(relativePath)) continue;
  const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  tokenPattern.lastIndex = 0;
  if (tokenPattern.test(source)) omittedCandidates.push(relativePath);
}

if (!findings.length) {
  throw new Error("Shared-surface audit produced no findings; verify the audited inventory and source ref.");
}
if (omittedCandidates.length) {
  throw new Error(`Authoritative inventory drift: token-bearing source files are not listed in auditedFiles: ${omittedCandidates.join(", ")}`);
}

console.log(JSON.stringify({
  audit: "shared-surface-contrast",
  auditedFiles: auditedFiles.length,
  authoritativeRoots,
  findings: findings.length,
  findings,
  omittedCandidates,
}, null, 2));
