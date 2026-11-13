import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { init, parse } from 'es-module-lexer';

await init;
const dir=path.resolve('dist/assets');
const files=fs.readdirSync(dir).filter(file=>file.endsWith('.js'));
const all=new Set(files);
const graph=new Map();
for (const file of files){
  const source=fs.readFileSync(path.join(dir,file),'utf8');
  const [imports]=parse(source);
  const dependencies=imports.filter(item=>item.d===-1 && item.n?.startsWith('./'))
    .map(item=>item.n.slice(2)).filter(item=>all.has(item));
  graph.set(file,dependencies);
}
const visited=new Set(),active=[],found=[];
function traverse(file){
  const index=active.indexOf(file);
  if(index>=0){found.push(active.slice(index).concat([file]));return;}
  if(visited.has(file))return;
  active.push(file);
  for(const dependency of graph.get(file)||[])traverse(dependency);
  active.pop();
  visited.add(file);
}
for(const file of files)traverse(file);
assert.deepEqual(found,[],'Circular static JavaScript imports would break production initialization: '+JSON.stringify(found.slice(0,4)));
const react=files.find(f=>/^react-runtime-.*\.js$/.test(f));
assert.ok(react,'Framework runtime must be its own coherent chunk');
// Wallet SDKs ship only where a page offers one. When a wallet runtime is
// emitted, viem must own a coherent chunk of its own rather than being merged
// into the framework runtime; with no wallet surface, no viem chunk is expected.
const wallet=files.filter(f=>/^(?:reown-|walletconnect-|coinbase-wallet-|base-wallet-)/.test(f));
const viem=files.find(f=>/^viem-runtime-.*\.js$/.test(f));
assert.ok(!wallet.length||viem,'viem must own a coherent runtime chunk whenever a wallet runtime ships');
console.log('PASS: '+files.length+' JavaScript chunks have no circular static imports.');