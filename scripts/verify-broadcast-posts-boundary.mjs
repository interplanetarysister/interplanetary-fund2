import fs from 'node:fs';
const source = fs.readFileSync(new URL('../base44/functions/broadcastPosts/entry.ts', import.meta.url), 'utf8');
for (const fragment of ["req.method !== 'POST'", 'Invalid JSON body.', 'campaign_id', 'Object.prototype.toString.call', 'isNotFound', 'getConnection', 'MAX_RESULTS', 'project =', 'Social publishing is currently disabled.', 'Math.min(100']) {
  if (!source.includes(fragment)) throw new Error(`missing contract: ${fragment}`);
}
for (const forbidden of ['error.message', 'results.posts.push(updated)', 'access.reason', 'connection.history || []']) {
  if (source.includes(forbidden)) throw new Error(`unsafe disclosure/drift: ${forbidden}`);
}
console.log('broadcastPosts boundary verifier passed');
