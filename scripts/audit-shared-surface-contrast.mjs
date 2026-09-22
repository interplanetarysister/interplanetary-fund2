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
];

const tokenPattern = /text-stone-(400|500|600|700|800|900)/g;
const findings = [];

for (const relativePath of auditedFiles) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing audited file: ${relativePath}`);
  }
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(tokenPattern)) {
      findings.push({ file: relativePath, line: index + 1, token: match[0], text: line.trim() });
    }
  });
}

if (!findings.length) {
  throw new Error("Shared-surface audit produced no findings; verify the audited inventory and source ref.");
}

console.log(JSON.stringify({
  audit: "shared-surface-contrast",
  auditedFiles: auditedFiles.length,
  findings: findings.length,
  findings,
}, null, 2));
