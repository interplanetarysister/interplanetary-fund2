import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const social = read('base44/shared/socialPublish.ts');
const publish = read('base44/functions/publishPost/entry.ts');
const broadcast = read('base44/functions/broadcastPosts/entry.ts');

assert.match(social, /connection\?\.platform === 'mastodon'\) return false/);
assert.match(social, /Live Mastodon publishing is unavailable in this runtime/);
assert.doesNotMatch(social, /https:\/\/\$\{host\}\/api\/v1\/statuses/);
assert.doesNotMatch(social, /errBody\.slice/);

for (const source of [publish, broadcast]) {
  assert.match(source, /direct_publish_verified === true/);
  assert.match(source, /test_status === 'passing'/);
  assert.match(source, /implementation_status === 'implemented'/);
}
assert.match(broadcast, /canPublishViaConnector/);
assert.match(broadcast, /publishThroughConnection\(connection, text, sr\)/);
assert.doesNotMatch(publish, /pubError.*message \?/);
assert.doesNotMatch(publish, /console\.error\('publishPost error:', error\.message\)/);

console.log('social publishing truth and transport safety contract: PASS');
