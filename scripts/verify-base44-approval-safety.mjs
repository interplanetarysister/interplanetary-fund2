import fs from 'node:fs';

const entry = fs.readFileSync('base44/functions/requestWithdrawal/entry.ts', 'utf8');
const approveStart = entry.indexOf("if (action === 'approve')");
if (approveStart < 0) throw new Error('Missing approve action branch.');
const approveEnd = entry.indexOf("const { campaign_id", approveStart);
const approveBranch = entry.slice(approveStart, approveEnd < 0 ? entry.length : approveEnd);

if (!approveBranch.includes("user.role !== 'admin'")) {
  throw new Error('Approve path must enforce server-derived admin authorization.');
}
if (!approveBranch.includes('canonical_operation_key') || !approveBranch.includes('canonical_reservation_id')) {
  throw new Error('Approve path must require canonical reservation identity.');
}

const payoutIndex = approveBranch.indexOf('sendPayout(');
const gateIndex = approveBranch.indexOf('SAFE_APPROVAL_UNAVAILABLE');
if (payoutIndex >= 0 && gateIndex < 0) {
  throw new Error('Approve path dispatches a provider payout without an explicit safe claim/fence gate.');
}
if (payoutIndex >= 0 && gateIndex > payoutIndex) {
  throw new Error('Fail-closed approval gate must occur before any provider dispatch.');
}

console.log('Base44 approval safety guard passed.');
