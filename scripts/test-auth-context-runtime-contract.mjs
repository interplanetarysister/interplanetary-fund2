import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/lib/AuthContext.jsx', 'utf8');
assert.match(source, /checkAppState/);
assert.match(source, /checkUserAuth/);
assert.match(source, /checkAppState\s*\n?\s*}\s*\}>/);
assert.match(source, /safeErrorDiagnostic\(appError\)/);
assert.match(source, /safeErrorDiagnostic\(error\)/);
assert.match(source, /SAFE_AUTH_REASONS/);
assert.match(source, /try \{[\s\S]*error\?\.status === 401/);
assert.doesNotMatch(source, /console\.error\([^\n]*,\s*(?:appError|error)\s*\)/);
assert.doesNotMatch(source, /message:\s*error\.message/);
assert.doesNotMatch(source, /message:\s*appError\.message/);
console.log('auth context runtime contract source checks passed');
