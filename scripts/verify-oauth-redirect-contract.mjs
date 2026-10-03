import assert from 'node:assert/strict';
import fs from 'node:fs';
import { trustedOAuthRedirect } from '../src/lib/oauthRedirect.js';

const origin = 'https://fund.example';
assert.equal(trustedOAuthRedirect('javascript:alert(1)', origin), null);
assert.equal(trustedOAuthRedirect('data:text/html,unsafe', origin), null);
assert.equal(trustedOAuthRedirect('file:///tmp/token', origin), null);
assert.equal(trustedOAuthRedirect('http://attacker.example/callback', origin), null);
assert.equal(trustedOAuthRedirect('https://user:secret@example.com/callback', origin), null);
assert.deepEqual(trustedOAuthRedirect('/oauth/complete', origin), {
  url: 'https://fund.example/oauth/complete', browser: true,
});
assert.equal(trustedOAuthRedirect('https://client.example/callback', origin)?.browser, true);
assert.equal(trustedOAuthRedirect('http://127.0.0.1:45123/callback', origin)?.browser, true);
assert.equal(trustedOAuthRedirect('cursor://oauth/callback', origin)?.browser, false);
assert.equal(trustedOAuthRedirect('vscode://extension/callback', origin)?.browser, false);

const consent = fs.readFileSync('src/pages/OAuthConsent.jsx', 'utf8');
assert.match(consent, /trustedOAuthRedirect\(data\.redirect_url, window\.location\.origin\)/);
assert.match(consent, /window\.location\.assign\(redirect\.url\)/);
assert.doesNotMatch(consent, /window\.location\.(?:href\s*=|assign\()\s*data\.redirect_url/);

console.log('OAuth redirect scheme, loopback, native-client, and navigation contract verified.');
