import fs from 'node:fs';

const ui = fs.readFileSync('src/components/ops/FundMigrationDashboard.jsx', 'utf8');
const workflow = fs.readFileSync('base44/functions/createFundMigration/entry.ts', 'utf8');
const withdrawal = fs.readFileSync('base44/entities/Withdrawal.jsonc', 'utf8');
const campaign = fs.readFileSync('base44/entities/Campaign.jsonc', 'utf8');

const required = [
  [ui, 'base44.functions.invoke("createFundMigration"', 'UI must use the server migration workflow'],
  [ui, 'payout_destination: payoutDest.trim()', 'UI must pass the entered payout destination to the server'],
  [workflow, "user.role !== 'admin'", 'migration workflow must be admin-only'],
  [workflow, 'active_migration_request_id', 'campaign migration claim must be server-side'],
  [workflow, 'migration_request_id', 'stable migration request identity must be persisted'],
  [workflow, 'PLATFORM_FEE_RATE = 0.08', 'migration fee must use the authoritative withdrawal rate'],
  [workflow, 'ALLOWED_PAYOUT_METHODS', 'workflow must explicitly constrain payout methods'],
  [withdrawal, 'migration_request_id', 'withdrawal schema must retain migration request identity'],
  [campaign, 'active_migration_request_id', 'campaign schema must retain the migration claim'],
];

for (const [text, needle, message] of required) {
  if (!text.includes(needle)) throw new Error(`FAIL: ${message}`);
}

const forbiddenUi = [
  'base44.entities.Withdrawal.create',
  'destination: "$unrewound"',
  'destination: "interplanetarysister@gmail.com"',
  'destination: "bc1qfgwz5fasnkml0f2z7ynvw5lk6v77ez66fql3pz"',
];
for (const needle of forbiddenUi) {
  if (ui.includes(needle)) throw new Error(`FAIL: legacy/hardcoded migration path remains: ${needle}`);
}

if (!/const ALLOWED_PAYOUT_METHODS = new Set\(\['paypal'\]\)/.test(workflow)) {
  throw new Error('FAIL: migration payout allowlist is not PayPal-only.');
}
if (!/if \(user\.role !== 'admin'\)/.test(workflow)) {
  throw new Error('FAIL: admin authorization boundary missing.');
}
if (!/active_migration_request_id: \{\$exists: false\}/.test(workflow)) {
  throw new Error('FAIL: conditional campaign migration claim missing.');
}
if (!/Withdrawal\.create\(\{[\s\S]*migration_request_id: requestId/.test(workflow)) {
  throw new Error('FAIL: withdrawal does not persist the stable migration identity.');
}

console.log('PASS: Fund Migration uses an admin-only authoritative server workflow, stable campaign claim, server-side financial validation, persisted migration identity, and no hardcoded payout destination/direct client Withdrawal.create.');
