import fs from 'node:fs';

const contract = fs.readFileSync('docs/BASE44_FRAUD_WORKFLOW_CONTRACT.md', 'utf8');
const panel = fs.readFileSync('src/components/platform/FraudControlPanel.jsx', 'utf8');

const requiredContractPhrases = [
  'approve/deny decisions are performed by authenticated server-side actions',
  'fraud-held withdrawal approval/denial is restricted to an authenticated admin/fraud-review role',
  'Single winner',
  'Idempotency',
  'approved platform fee is 3%',
];
for (const phrase of requiredContractPhrases) {
  if (!contract.includes(phrase)) throw new Error(`Missing contract invariant: ${phrase}`);
}

const forbiddenFragments = [
  'entities.Withdrawal.update(',
  'entities.Campaign.update(',
  'status: "paid"',
  'status: "failed"',
  'status: "paused"',
  'status: "active"',
];
for (const fragment of forbiddenFragments) {
  if (panel.includes(fragment)) throw new Error(`Forbidden client mutation fragment: ${fragment}`);
}

const failClosedMarkers = [
  'SAFE_ADMIN_ERROR',
  'Admin moderation unavailable',
  'intentionally unavailable in the browser',
];
for (const marker of failClosedMarkers) {
  if (!panel.includes(marker)) throw new Error(`Missing fail-closed marker: ${marker}`);
}

console.log('Fraud workflow contract guard passed.');
