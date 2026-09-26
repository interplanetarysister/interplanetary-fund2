import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Onboarding.jsx', 'utf8');
assert.match(source, /safeErrorDiagnostic\(error\)/);
assert.match(source, /finally\s*\{[\s\S]*setSaving\(false\)/);
assert.doesNotMatch(source, /console\.error\([^\n]*,\s*error\s*\)/);
assert.doesNotMatch(source, /console\.error\([^\n]*,\s*e\s*\)/);
assert.match(source, /onFinish=\{finish\}/);
console.log('onboarding safe diagnostics contract passed');
