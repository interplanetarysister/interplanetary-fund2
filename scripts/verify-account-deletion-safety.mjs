import fs from 'node:fs';

const entry = fs.readFileSync('base44/functions/deleteAccount/entry.ts', 'utf8');
const schema = fs.readFileSync('base44/entities/AccountDeletionRequest.jsonc', 'utf8');
const userSchema = fs.readFileSync('base44/entities/User.jsonc', 'utf8');
const ui = fs.readFileSync('src/components/account/AccountManagement.jsx', 'utf8');

const failures = [];
const requirePattern = (pattern, message, source = entry) => {
  if (!pattern.test(source)) failures.push(message);
};

requirePattern(/AccountDeletionRequest\.filter\(\{ user_id: user\.id \}\)/, 'deletion flow must scope existing requests to authenticated user');
requirePattern(/account_deletion_status: \{ \$ne: CLAIMED \}/, 'deletion flow must claim the authenticated user before creating a request');
requirePattern(/User\.updateMany\(/, 'deletion flow must use the user-scoped conditional claim boundary');
requirePattern(/request_id: requestId/, 'deletion request must persist a stable request identity');
requirePattern(/claim_token: claimToken/, 'deletion request must persist the claim token');
requirePattern(/AccountDeletionRequest\.create\(/, 'deletion flow must create a durable deletion request');
requirePattern(/status: ['"]requested['"]/, 'new deletion requests must start in requested state');
requirePattern(/Unable to start account deletion/, 'unexpected deletion errors must use a stable safe client message');
requirePattern(/console\.error\('deleteAccount request failed:', error\)/, 'unexpected deletion diagnostics must remain server-side');

if (/entities\.(Donation|Withdrawal|Campaign|User)\.(delete|deleteMany)\(/.test(entry)) {
  failures.push('account deletion request endpoint must not directly destructively delete financial/account records');
}

for (const required of ['requested', 'processing', 'completed', 'failed', 'user_id', 'request_id', 'claim_token', 'requested_at', 'attempt_count']) {
  if (!schema.includes(`"${required}"`)) failures.push(`AccountDeletionRequest schema missing ${required}`);
}
for (const required of ['account_deletion_status', 'account_deletion_request_id', 'account_deletion_claim_token']) {
  if (!userSchema.includes(`"${required}"`)) failures.push(`User schema missing ${required}`);
}
for (const preserved of ['role', 'onboarding_completed', 'onboarding', 'comm_prefs', 'subscription_tier', 'subscription_status', 'subscription_interval', 'stripe_customer_id', 'subscription_renews_at', 'trial_end']) {
  if (!userSchema.includes(`"${preserved}"`)) failures.push(`User schema must preserve ${preserved}`);
}
if (/Account deleted/.test(ui) || /permanently removes your campaigns/.test(ui)) failures.push('deletion UI must not imply destructive completion from request initiation');
if (!/Account deletion requested/.test(ui)) failures.push('deletion UI must acknowledge request state rather than completion');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Account deletion safety contract verified.');
