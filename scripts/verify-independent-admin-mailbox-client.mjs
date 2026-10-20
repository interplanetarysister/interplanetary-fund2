import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync('src/components/inbox/IndependentAdminMail.jsx', 'utf8');
assert.match(src, /ifund-admin-mailbox/);
assert.match(src, /authorization:/);
assert.match(src, /type="password"/);
assert.doesNotMatch(src, /localStorage\.setItem|sessionStorage\.setItem/);
console.log('PASS: independent mailbox client uses bearer auth without persisting access tokens.');
