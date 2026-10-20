import fs from 'node:fs';
import crypto from 'node:crypto';

const origins = process.env.IFUND_SMOKE_URL ? [process.env.IFUND_SMOKE_URL] : [
  'https://interplanetaryfund.com',
  'https://www.interplanetaryfund.com',
  'https://interplanetary-fund2.interplanetary-fund.workers.dev',
  'https://interplanetaryfund.base44.app',
];
const localHtml = fs.readFileSync('dist/index.html','utf8');
const entry = html => html.match(/(?:src=["'])(\/assets\/index-[\w-]+\.js)(?:["'])/)?.[1] || '';
const localPath = entry(localHtml);
if (!localPath) throw Error('Local release is missing its entry bundle');
const localJs = fs.readFileSync('dist'+localPath);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const localHash=hash(localJs);
const results=[];
for (const origin of origins) {
  try {
    const site=origin.replace(/\/$/,'');
    const response=await fetch(site+'/?ifund_build_check='+Date.now(),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('HTML returned '+response.status);
    const livePath=entry(await response.text());
    if(!livePath)throw Error('HTML is missing its JS entry');
    const liveResponse=await fetch(new URL(livePath,site),{signal:AbortSignal.timeout(15000)});
    if(!liveResponse.ok)throw Error('Asset returned '+liveResponse.status);
    const liveHash=hash(Buffer.from(await liveResponse.arrayBuffer()));
    results.push({origin:site,livePath,liveHash,matched:localHash===liveHash});
  } catch(error) {
    results.push({origin,error:String(error.message||error),matched:false});
  }
}
console.log(JSON.stringify({localPath,localHash,results},null,2));
if(results.some(result=>!result.matched))process.exitCode=1;
