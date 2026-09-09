import fs from 'node:fs';

const contract = fs.readFileSync('docs/BASE44_FRAUD_WORKFLOW_CONTRACT.md', 'utf8');
const panel = fs.readFileSync('src/components/admin/FraudControlPanel.jsx', 'utf8');

const requiredContractPhrases = [
  'approve/deny decisions are performed by authenticated server-side actions',
  'fraud-held withdrawal approval/denial is restricted to an authenticated admin/fraud-review role',
  'campaign owners/operators may request withdrawal or submit evidence only',
  'Single winner',
  'Idempotency',
  'approved platform fee is 3%',
];
for (const phrase of requiredContractPhrases) {
  if (!contract.includes(phrase)) {
    throw new Error(`Fraud workflow contract missing required invariant: ${phrase}`);
  }
}

const forbiddenPanelPatterns = [
  /entities\.Withdrawal\.update\(/,
  /entities\.Campaign\.update\(/,
  /status:\s*["'](?:paid|failed|paused|active)["']/,
];
for (const pattern of forbiddenPanelPatterns) {
  if (pattern.test(panel)) {
    throw new Error(`FraudControlPanel contains a forbidden direct client-side mutation pattern: ${pattern}`);
  }
}

if (!panel.includes('functions.invoke("requestWithdrawal"')) {
  throw new Error('FraudControlPanel must route approval through requestWithdrawal server function.');
}

console.log('Fraud workflow contract guard passed.');
