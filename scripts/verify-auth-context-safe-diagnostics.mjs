import fs from 'node:fs';

const source = fs.readFileSync('src/lib/AuthContext.jsx', 'utf8');
const checks = [
  ['bounded diagnostic classifier', source.includes('classifyDiagnostic')],
  ['cross-realm error classification', source.includes("Object.prototype.toString.call(error)") && source.includes("[object Error]")],
  ['safe logger', source.includes('logSafeDiagnostic')],
  ['allowlisted auth reasons', source.includes('ALLOWED_AUTH_REASONS') && source.includes('getSafeAuthReason')],
  ['no raw app-state exception logging', !source.includes("console.error('App state check failed:', appError)")],
  ['no raw unexpected exception logging', !source.includes("console.error('Unexpected error:', error)")],
  ['no raw auth exception logging', !source.includes("console.error('User auth check failed:', error)")],
  ['safe app copy preserved', source.includes('SAFE_APP_ERROR')],
  ['auth status optional chaining', source.includes('appError?.status') && source.includes('error?.status')],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`AuthContext diagnostic check failed: ${label}`);
}

console.log('AuthContext safe diagnostics checks passed.');
