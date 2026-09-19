import fs from "node:fs";

const file = fs.readFileSync("src/components/platform/FraudControlPanel.jsx", "utf8");
const required = [
  ["stable safe error", 'SAFE_FRAUD_ERROR = "The requested fraud-control action could not be completed. Please retry."'],
  ["mounted fencing", "mountedRef"],
  ["load generation fencing", "loadGenerationRef"],
  ["single flight", "busyRef"],
  ["finally cleanup", "finally { busyRef.current.delete(key); }"],
  ["safe catch", "catch { safeMessage(false); return false; }"],
  ["array fail closed", "const asArray = (value) => (Array.isArray(value) ? value : []);"],
];
for (const [name, needle] of required) {
  if (!file.includes(needle)) throw new Error(`Missing ${name}: ${needle}`);
}
for (const forbidden of ["e.message", "error.message", "String(e)", "String(error)", "{e}"]) {
  if (file.includes(forbidden)) throw new Error(`Raw diagnostic sink remains: ${forbidden}`);
}
for (const action of ["approve:", "deny:", "unfreeze:", "freeze:"]) {
  if (!file.includes(action)) throw new Error(`Missing action key: ${action}`);
}
console.log("FraudControlPanel safe-action verifier passed.");
