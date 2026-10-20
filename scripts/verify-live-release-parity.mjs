import fs from 'node:fs';
import crypto from 'node:crypto';

const origins = process.env.IFUND_SMOKE_URL ? [process.env.IFUND_SMOKE_URL] : [
  'https://interplanetaryfund.com',
  'https://www.interplanetaryfund.com',
  'https://interplanetary-fund2.interplanetary-fund.workers.dev',
  'https://interplanetaryfund.base44.app',
];
const localHtml = fs.readFileSync('dist/index.html', 'utf8');
const entry = html => html.match(/(?:src=["'])(\/assets\/index-[\w-]+\.js)(?:["'])/)?.[1] || '';
const criticalAssets = html => {
  const main = entry(html);
  if (!main) throw Error('Release is missing its JS entry bundle');
  const assets = [{ type: 'entry', path: main }];
  for (const match of html.matchAll(/<link\b[^>]*\brel=["'](stylesheet|modulepreload)["'][^>]*\bhref=["'](\/assets\/[^"']+)["']/g)) {
    assets.push({ type: match[1], path: match[2] });
  }
  if (!assets.some(asset => asset.type === 'stylesheet')) throw Error('Release is missing its stylesheet');
  return assets;
};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const localAssets = criticalAssets(localHtml).map(asset => ({
  ...asset, hash: hash(fs.readFileSync('dist' + asset.path)),
}));
const localPath = localAssets[0].path;
const localHash = localAssets[0].hash;
const results=[];
for (const origin of origins) {
  try {
    const site=origin.replace(/\/$/,'');
    const response=await fetch(site+'/?ifund_build_check='+Date.now(),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('HTML returned '+response.status);
    const liveAssets = criticalAssets(await response.text());
    const livePath = liveAssets[0].path;
    const compared = [];
    for (let i = 0; i < Math.max(localAssets.length, liveAssets.length); i++) {
      const local = localAssets[i];
      const remote = liveAssets[i];
      if (!local || !remote || local.type !== remote.type) {
        compared.push({ type: local?.type || remote?.type, matched: false, reason: 'Asset list differs' });
        continue;
      }
      const liveResponse = await fetch(new URL(remote.path, site), { signal: AbortSignal.timeout(15000) });
      if (!liveResponse.ok) {
        compared.push({ type: remote.type, path: remote.path, matched: false, reason: 'HTTP ' + liveResponse.status });
        continue;
      }
      const liveHash = hash(Buffer.from(await liveResponse.arrayBuffer()));
      compared.push({ type: remote.type, path: remote.path, matched: local.hash === liveHash });
    }
    results.push({ origin: site, livePath, assetsChecked: compared.length,
      mismatches: compared.filter(asset => !asset.matched), matched: compared.every(asset => asset.matched) });
  } catch(error) {
    results.push({origin,error:String(error.message||error),matched:false});
  }
}
console.log(JSON.stringify({localPath,localHash,results},null,2));
if(results.some(result=>!result.matched))process.exitCode=1;
