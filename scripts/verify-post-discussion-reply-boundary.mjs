import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/postDiscussionReply/entry.ts', 'utf8');
const required = [
  ['POST-only guard', source.includes("req.method !== 'POST'")],
  ['Allow header', source.includes("Allow: 'POST'")],
  ['safe error copy', source.includes('SAFE_ERROR')],
  ['bounded diagnostic type', source.includes('diagnosticType')],
  ['body record validation', source.includes('isRecord(body)')],
  ['unexpected key rejection', source.includes('allowedKeys')],
  ['normalized post id', source.includes('const postId')],
  ['community binding', source.includes('communityId !== serverCommunityId')],
  ['bounded content', source.includes('MAX_CONTENT_LENGTH')],
  ['server-derived community persistence', source.includes('community_id: serverCommunityId')],
  ['atomic reply increment', source.includes('$inc: { reply_count: 1 }')],
  ['explicit not-found classification', source.includes('isNotFoundError')],
  ['lookup failure propagation', source.includes('getPostOrThrow') && !source.includes('.get(postId).catch(() => null)')],
  ['no raw error.message logging', !source.includes('console.error(\'postDiscussionReply error:\', error.message)')],
];

const failures = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`postDiscussionReply boundary verifier failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('postDiscussionReply boundary verifier passed');
