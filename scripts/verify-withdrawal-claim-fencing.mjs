import { readFile } from 'node:fs/promises';

const source = await readFile('base44/functions/requestWithdrawal/entry.ts', 'utf8');
const failures = [];

// A reconciliation/finalization path must remain fenced to the same durable
// payout claim that authorized the provider side effect. Status-only matching
// is insufficient because a stale worker can otherwise finalize after a
// takeover or replay.
if (!/payout_claim_token\s*:\s*claimToken/.test(source)) {
  failures.push('approve finalization must condition on payout_claim_token == claimToken');
}
if (!/reconcileApprovedPayout\(sr,\s*await sr\.entities\.Withdrawal\.get\(w\.id\),\s*claimToken\)/.test(source)) {
  failures.push('approval recovery must pass the current claim token into reconciliation');
}
if (!/reconcileApprovedPayout\(sr,\s*await sr\.entities\.Withdrawal\.get\(withdrawal\.id\),\s*[^)]*payout_claim_token/.test(source)) {
  failures.push('request recovery must preserve and pass the durable claim token');
}

if (failures.length) {
  console.error('Withdrawal claim-fencing verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Withdrawal claim-fencing verification passed.');
