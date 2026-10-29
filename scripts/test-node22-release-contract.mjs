import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyReleaseContract} from './verify-node22-release-contract.mjs';
function fixture() {
 const dir=mkdtempSync(join(tmpdir(),'node20-contract-'));
 mkdirSync(join(dir,'.github/workflows'),{recursive:true});
 writeFileSync(join(dir,'package.json'),JSON.stringify({
  engines:{node:'>=20'},
  scripts:{
   'verify:feature-flags':'node --experimental-loader ./scripts/js-compatible-ts-loader.mjs scripts/verify-feature-flag-connections.mjs',
   'verify:studio-contracts':'node --experimental-loader ./scripts/js-compatible-ts-loader.mjs scripts/verify-feature-flag-connections.mjs',
  },
 }));
 writeFileSync(join(dir,'package-lock.json'),JSON.stringify({packages:{'':{engines:{node:'>=20'}}}}));
 writeFileSync(join(dir,'.node-version'),'24\n');
 writeFileSync(join(dir,'.nvmrc'),'24\n');
 writeFileSync(join(dir,'.github/workflows/check.yml'),"jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '24'\n");
 return dir;
}
function test(label,mutate,expected){
 const dir=fixture();
 try{mutate(dir);const errors=verifyReleaseContract(dir);assert.equal(expected(errors),true,label+': '+JSON.stringify(errors))}
 finally{rmSync(dir,{recursive:true,force:true})}
}
test('Node 24 release baseline supported',()=>{},errors=>errors.length===0);
test('Node 20 setup lane supported',d=>writeFileSync(join(d,'.github/workflows/check.yml'),"jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n"),errors=>errors.length===0);
test('Node 22-only type stripping rejected',d=>{
 const pkg=JSON.parse(readFileSync(join(d,'package.json'),'utf8'));
 pkg.scripts['verify:feature-flags']='node --experimental-strip-types scripts/verify-feature-flag-connections.mjs';
 writeFileSync(join(d,'package.json'),JSON.stringify(pkg));
},errors=>errors.some(e=>e.includes('must not require Node 22 type stripping')));
test('missing Node 20 TypeScript loader rejected',d=>{
 const pkg=JSON.parse(readFileSync(join(d,'package.json'),'utf8'));
 pkg.scripts['verify:studio-contracts']='node scripts/verify-feature-flag-connections.mjs';
 writeFileSync(join(d,'package.json'),JSON.stringify(pkg));
},errors=>errors.some(e=>e.includes('must use the Node 20-compatible TypeScript loader')));
test('outdated Node 18 lane rejected',d=>writeFileSync(join(d,'.github/workflows/check.yml'),"jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 18\n"),errors=>errors.some(e=>e.includes('Node 20 or newer')));
test('engines upper bound rejected',d=>writeFileSync(join(d,'package.json'),JSON.stringify({engines:{node:'>=20 <26'}})),errors=>errors.some(e=>e.includes('engine')));
test('outdated Node 18 nvm rejected',d=>writeFileSync(join(d,'.nvmrc'),'18\n'),errors=>errors.some(e=>e.includes('.nvmrc')));
test('malformed metadata rejected',d=>writeFileSync(join(d,'package.json'),'{'),errors=>errors.some(e=>e.includes('malformed:')));
const source=readFileSync(new URL('./require-node22.mjs',import.meta.url),'utf8');
assert.match(source,/MINIMUM_NODE_MAJOR = 20/);
assert.doesNotMatch(source,/TESTED_NODE_MAJORS/);
console.log('PASS: Node 20+ baseline negative tests');
