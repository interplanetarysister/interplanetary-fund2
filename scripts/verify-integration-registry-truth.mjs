import fs from "node:fs";
import { mergeIntegrationStatus, normalizeIntegrationStatus } from "../base44/shared/integrationStatusPolicy.js";

const read = (path) => fs.readFileSync(path, "utf8");
const manage = read("base44/functions/managePlatformAccess/entry.ts");
const health = read("base44/functions/validateIntegrationHealth/entry.ts");
const page = read("src/pages/IntegrationsAdmin.jsx");
const panel = read("src/components/admin/IntegrationDetailPanel.jsx");
const table = read("src/components/admin/IntegrationsTable.jsx");
const ui = read("src/lib/integrationRegistryUi.js");

const requireText = (source, text, label) => {
  if (!source.includes(text)) throw new Error(`Missing contract: ${label}`);
};
const rejectText = (source, text, label) => {
  if (source.includes(text)) throw new Error(`Unsafe contract remains: ${label}`);
};

requireText(manage, "status: 'DISCONNECTED'", "new registry rows fail closed");
requireText(manage, "status: 'REAUTH_REQUIRED'", "reauthorization requires verification");
rejectText(manage, "status: 'ACTIVE', last_failure: ''", "manual action cannot activate");
requireText(health, "mergeIntegrationStatus", "shared status precedence is used");
if (normalizeIntegrationStatus("PENDING") !== "DISCONNECTED") throw new Error("Malformed status did not fail closed");
for (const candidate of ["MISCONFIGURED", "REAUTH_REQUIRED", "ACTIVE", "DISCONNECTED"]) {
  if (mergeIntegrationStatus("REVOKED", candidate) !== "REVOKED") {
    throw new Error(`Revoked status was lost for candidate ${candidate}`);
  }
}
if (mergeIntegrationStatus("MISCONFIGURED", "ACTIVE") !== "MISCONFIGURED") {
  throw new Error("Provider success overrode misconfiguration");
}
requireText(health, "mergeIntegrationStatus(status, normalizeIntegrationStatus(e.status))", "platform-managed status preserves safe stored truth");
requireText(health, "providerVerified = false", "verification evidence tracked");
requireText(health, "mergeIntegrationStatus(status, 'ACTIVE')", "provider success uses precedence policy");
rejectText(health, "err?.message", "provider errors are not persisted");
requireText(health, "result.status === 'ACTIVE' && result.providerVerified", "success timestamp requires provider evidence");
requireText(page, "normalizeRegistryEntries", "registry rows normalize before render");
requireText(page, "normalizeIntegrationStatus(entry.status)", "malformed UI status maps to Unknown");
requireText(page, "withTimeout(", "admin requests are bounded");
requireText(page, "invokeWithLock", "locks follow underlying request settlement");
requireText(page, "pending.then(() => { lock.current = false; }, () => { lock.current = false; })", "timeout cannot release active mutation lock");
requireText(page, "invokeWithLock(healthLock", "health duplicate action lock");
requireText(page, "invokeWithLock(githubLock", "GitHub duplicate action lock");
requireText(page, "setSelected(fresh || null)", "selected row reconciles after refresh");
requireText(page, "isGitHubResponse", "GitHub response validated");
requireText(panel, "UNKNOWN_STATUS_BADGE", "detail status fails closed");
requireText(table, "UNKNOWN_STATUS_BADGE", "table status fails closed");
rejectText(table, "STATUS_BADGE[e.status] || STATUS_BADGE.ACTIVE", "table cannot default unknown state to active");
requireText(panel, "operationLock.current", "detail actions use synchronous lock");
rejectText(panel, "description: e.message", "raw errors are not rendered");
rejectText(panel, "v.detail", "provider result details are not rendered");
rejectText(panel, "data?.reason", "provider reasons are not rendered");
rejectText(page, "v.detail", "page does not render provider result details");
rejectText(page, "data?.reason", "page does not render provider reasons");
requireText(ui, "normalizeIntegrationStatus", "shared status normalization helper exists");
requireText(ui, "UNKNOWN_STATUS_BADGE", "unknown status has explicit neutral badge");

console.log("Integration registry truth contract verified.");
