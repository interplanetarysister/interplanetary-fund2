import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync('src/components/inbox/IndependentAdminMail.jsx', 'utf8');
assert.match(src, /ifund-admin-mailbox/);
assert.match(src, /authorization:/);
assert.match(src, /type="password"/);
assert.doesNotMatch(src, /localStorage\.setItem|sessionStorage\.setItem/);
assert.match(src, /error\.status=response\.status/, 'HTTP authorization failures must retain their status');
assert.match(src, /if\(e\?\.status===401\|\|e\?\.status===403\)signOut\(\)/, 'expired/revoked sessions must sign out');
assert.ok(src.includes('sessionGeneration.current+=1;setToken('), 'sign-out must invalidate pending responses');
assert.match(src, /setReady\(false\);setItems\(\[\]\);try\{const r=await request/, 'refresh must hide previously loaded private mail');
assert.match(src, /if\(generation!==sessionGeneration\.current\)return/, 'stale async responses must not repopulate private mail');
assert.match(src, /Number\(s\.expires_in\)/, 'sign-in must validate server session lifetime');
assert.match(src, /setExpiresAt\(Date\.now\(\)\+expiresIn\*1000\)/, 'session expiry must use server lifetime');
assert.match(src, /setTimeout\(\(\)=>signOut\(\),Math\.max\(0,expiresAt-Date\.now\(\)\)\)/, 'expired session must automatically clear private messages');
assert.match(src, /return \(\)=>clearTimeout\(timer\)/, 'expiry timer must be cleared on sign-out and unmount');
const requestSource = src.slice(src.indexOf('const base='), src.indexOf('export default function'));
async function checkResponse(status) {
  const context = { fetch: async () => ({ ok: status >= 200 && status < 300, status, json: async () => ({ messages: [] }) }) };
  vm.runInNewContext(requestSource + ';globalThis.testRequest=request;', context);
  return context.testRequest('/functions/v1/ifund-admin-mailbox', { headers: { authorization: 'Bearer test' } });
}
for (const status of [401, 403, 503]) {
  await assert.rejects(checkResponse(status), error => error.status === status, 'request must expose HTTP status ' + status);
}
assert.equal((await checkResponse(200)).messages.length, 0);
console.log('PASS: independent mailbox clears unauthorized sessions, ignores stale responses, and preserves HTTP statuses.');
