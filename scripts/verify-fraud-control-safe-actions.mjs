import fs from "node:fs";

const panel = fs.readFileSync("src/components/platform/FraudControlPanel.jsx", "utf8");
const endpoint = fs.readFileSync("base44/functions/fraudControlAction/entry.ts", "utf8");
const requiredPanel = [
  ["stable safe error", 'SAFE_FRAUD_ERROR = "The requested fraud-control action could not be completed. Please retry."'],
  ["mounted fencing", "mountedRef"],
  ["load generation fencing", "loadGenerationRef"],
  ["single flight", "busyRef"],
  ["finally cleanup", "finally { busyRef.current.delete(key); }"],
  ["safe catch", "catch { safeMessage(false); return false; }"],
  ["array validation", "const asArray = (value) => (Array.isArray(value) ? value : []);"],
  ["response envelope validation", "const responseData = (response)"],
  ["authoritative approval function", 'base44.functions.invoke("requestWithdrawal", { action: "approve", withdrawal_id: w.id })'],
  ["authoritative fraud action function", 'base44.functions.invoke("fraudControlAction"'],
  ["strict response action validation", "data.ok !== true || data.action !== action || data.target_id !== targetId"],
];
for (const [name, needle] of requiredPanel) {
  if (!panel.includes(needle)) throw new Error(`Missing ${name}: ${needle}`);
}
for (const forbidden of ["e.message", "error.message", "String(e)", "String(error)", "{e}", 'base44.entities.Withdrawal.update(w.id, { status: "paid"']) {
  if (panel.includes(forbidden)) throw new Error(`Unsafe client mutation or raw diagnostic remains: ${forbidden}`);
}
for (const action of ["approve:", "deny:", "unfreeze:", "freeze:"]) {
  if (!panel.includes(action)) throw new Error(`Missing action key: ${action}`);
}

const requiredEndpoint = [
  ["admin authorization", "user.role !== 'admin'"],
  ["supported action allowlist", "actionSet"],
  ["target validation", "targetId"],
  ["deny state transition", "withdrawal.status !== 'under_review'"],
  ["freeze idempotency", "duplicate: true"],
  ["audit logging", "logAudit"],
  ["safe endpoint error", "The requested fraud-control action could not be completed. Please retry."],
];
for (const [name, needle] of requiredEndpoint) {
  if (!endpoint.includes(needle)) throw new Error(`Missing ${name}: ${needle}`);
}
for (const forbidden of ["console.error", "err?.message", "error.message", "String(error)"]) {
  if (endpoint.includes(forbidden)) throw new Error(`Raw diagnostic sink remains in endpoint: ${forbidden}`);
}

console.log("FraudControlPanel authoritative safe-action verifier passed.");
