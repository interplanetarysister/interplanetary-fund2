import fs from 'node:fs';

const entry = fs.readFileSync('base44/functions/deleteAccount/entry.ts', 'utf8');
const schema = fs.readFileSync('base44/entities/AccountDeletionRequest.jsonc', 'utf8');

const failures = [];
const requirePattern = (pattern, message) => {
  if (!pattern.test(entry)) failures.push(message);
};

requirePattern(/AccountDeletionRequest\.filter\(\{ user_id: user\.id \}\)/, 'deletion flow must scope existing requests to authenticated user');
requirePattern(/AccountDeletionRequest\.create\(/, 'deletion flow must create a durable deletion request');
requirePattern(/status: ['"]requested['"]/, 'new deletion requests must start in requested state');
requirePattern(/Unable to start account deletion/, 'unexpected deletion errors must use a stable safe client message');
requirePattern(/console\.error\('deleteAccount request failed:', error\)/, 'unexpected deletion diagnostics must remain server-side');

if (/entities\.(Donation|Withdrawal|Campaign|User)\.(delete|deleteMany)\(/.test(entry)) {
  failures.push('account deletion request endpoint must not directly destructively delete financial/account records');
}

for (const required of ['requested', 'processing', 'completed', 'failed', 'user_id', 'requested_at', 'attempt_count']) {
  if (!schema.includes(`"${required}"`)) failures.push(`AccountDeletionRequest schema missing ${required}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Account deletion safety contract verified.');
