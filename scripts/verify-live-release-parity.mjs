import fs from 'node:fs';
import crypto from 'node:crypto';

const origin = process.env.IFUND_SMOKE_URL || 'https://interplanetaryfund.com';
const localHtml = fs.readFileSync('dist/index.html','utf8');
const entry = html => html.match(/(?:src=["'])(\/assets\/index-[\w-]+\.js)(?:["'])/)?.[1] || '';
const localPath = entry(localHtml);
if (!localPath) throw Error('Local release is missing its entry bundle');
const localJs = fs.readFileSync('dist'+localPath);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const response=await fetch(origin+'/?ifund_build_check='+Date.now(),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('Production HTML returned '+response.status);
const livePath = entry(await response.text());
if(!livePath)throw Error('Production HTML is missing its JS entry');
const liveResponse=await fetch(new URL(livePath,origin),{signal:AbortSignal.timeout(15000)});
if(!liveResponse.ok)throw Error('Production asset returned '+liveResponse.status);
const localHash=hash(localJs),liveHash=hash(Buffer.from(await liveResponse.arrayBuffer()));
console.log(JSON.stringify({localPath,livePath,localHash,liveHash,matched:localHash===liveHash},null,2));
if(localHash!==liveHash)process.exitCode=1;
