import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8'),donation=fs.readFileSync('base44/functions/createDonationCheckout/entry.ts','utf8'),subscription=fs.readFileSync('base44/functions/createSubscriptionCheckout/entry.ts','utf8');
assert.match(html,/rel="canonical" href="https:\/\/interplanetaryfund\.com\/"/);
assert.match(html,/property="og:url" content="https:\/\/interplanetaryfund\.com\/"/);
for(const source of [donation,subscription]){assert.match(source,/https:\/\/interplanetaryfund\.com/);assert.match(source,/https:\/\/www\.interplanetaryfund\.com/);}
assert.match(donation,/originUrl\.protocol !== 'https:'/);
assert.match(subscription,/originUrl\.protocol !== 'https:'/);
console.log('Production custom-domain and payment-return origin contract passed.');
