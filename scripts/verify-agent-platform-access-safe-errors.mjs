import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/verifyAgentPlatformAccess/entry.ts', 'utf8');
const required = [
  ['stable safe failure constant', source.includes("const SAFE_ACCESS_ERROR = 'verification failed'")],
  ['bounded diagnostic classifier', source.includes('function classifyError(error)')],
  ['no raw error message access', !source.includes('error.message')],
  ['no raw error in response', !source.includes('error: error')],
  ['safe diagnostic logging only', source.includes("console.error('verifyAgentPlatformAccess failed:', diagnostic)")],
  ['secret refs only on success', source.includes('secret_refs: authorized ? (entry.secret_refs || []) : []')],
];

for (const [label, ok] of required) {
  if (!ok) throw new Error(`verify-agent-platform-access safety check failed: ${label}`);
}

console.log('verify-agent-platform-access-safe-errors: passed');
