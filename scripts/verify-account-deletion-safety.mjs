import fs from 'node:fs';

const entry = fs.readFileSync('base44/functions/deleteAccount/entry.ts', 'utf8');
const schema = fs.readFileSync('base44/entities/AccountDeletionRequest.jsonc', 'utf8');
const userSchema = fs.readFileSync('base44/entities/User.jsonc', 'utf8');
const ui = fs.readFileSync('src/components/account/AccountManagement.jsx', 'utf8');

const failures = [];
const requirePattern = (pattern, message, source) => {
  if (!pattern.test(source)) failures.push(message);
};

requirePattern(/AccountDeletionRequest\.filter\(\{ user_id: user\.id \}\)/, 'existing deletion requests must be scoped to authenticated user', entry);
requirePattern(/AccountDeletionRequest\.create\(/, 'request must be durable', entry);
requirePattern(/status: 'requested'/, 'new requests must start in requested state', entry);
requirePattern(/const created = await sr\.entities\.AccountDeletionRequest\.create\(/, 'durable request must be created before the User claim', entry);
requirePattern(/const created = await sr\.entities\.AccountDeletionRequest\.create\([\s\S]*?\n\n    const claimResult = await sr\.entities\.User\.updateMany\(/, 'durable request must precede conditional user claim', entry);
requirePattern(/User\.updateMany\(/, 'deletion flow must use a conditional user claim', entry);
requirePattern(/account_deletion_status: \{ \$ne: CLAIMED \}/, 'claim must be single-winner at the user boundary', entry);
requirePattern(/request_id: requestId/, 'request must persist stable request identity', entry);
requirePattern(/existingRequestId && existingRequestId !== requestId/, 'losing concurrent request must reconcile against the winning request', entry);
requirePattern(/status: 'failed', last_error_code: DUPLICATE_REQUEST/, 'losing request must become a terminal duplicate rather than remain active', entry);
requirePattern(/Unable to start account deletion/, 'unexpected errors must use a stable client-safe message', entry);
requirePattern(/console\.error\('deleteAccount request failed:', error\)/, 'diagnostics must remain server-side', entry);

if (/entities\.(Donation|Withdrawal|Campaign|User)\.(delete|deleteMany)\(/.test(entry)) {
  failures.push('request endpoint must not destructively delete account or financial records');
}
for (const required of ['requested', 'processing', 'completed', 'failed', 'user_id', 'request_id', 'requested_at', 'attempt_count']) {
  if (!schema.includes(`"${required}"`)) failures.push(`AccountDeletionRequest schema missing ${required}`);
}
if (schema.includes('"claim_token"') || userSchema.includes('"account_deletion_claim_token"') || entry.includes('claimToken')) {
  failures.push('deletion claim tokens must not be persisted in client-readable request/user records');
}
for (const required of ['account_deletion_status', 'account_deletion_request_id']) {
  if (!userSchema.includes(`"${required}"`)) failures.push(`User schema missing ${required}`);
}
if (/Account deleted/.test(ui) || /permanently removes your campaigns/.test(ui)) failures.push('UI must not claim destructive completion at request time');
requirePattern(/Account deletion requested/, 'UI must acknowledge request state', ui);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Account deletion safety contract verified.');
