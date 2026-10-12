import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyReleaseContract} from './verify-node22-release-contract.mjs';
function fixture() {
 const dir=mkdtempSync(join(tmpdir(),'node-current-contract-'));
 mkdirSync(join(dir,'.github/workflows'),{recursive:true});
 writeFileSync(join(dir,'package.json'),JSON.stringify({engines:{node:'>=20'}}));
 writeFileSync(join(dir,'package-lock.json'),JSON.stringify({packages:{'':{engines:{node:'>=20'}}}}));
 writeFileSync(join(dir,'.node-version'),'node\n');
 writeFileSync(join(dir,'.nvmrc'),'node\n');
 writeFileSync(join(dir,'.github/workflows/check.yml'),"jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 'node'\n");
 return dir;
}
function test(label,mutate,expected){
 const dir=fixture();
 try{mutate(dir);const errors=verifyReleaseContract(dir);assert.equal(expected(errors),true,label+': '+JSON.stringify(errors))}
 finally{rmSync(dir,{recursive:true,force:true})}
}
test('modern Node supported',()=>{},errors=>errors.length===0);
test('hardcoded lane rejected',d=>writeFileSync(join(d,'.github/workflows/check.yml'),"jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n"),errors=>errors.some(e=>e.includes('pins a Node major')));
test('engines upper bound rejected',d=>writeFileSync(join(d,'package.json'),JSON.stringify({engines:{node:'>=20 <26'}})),errors=>errors.some(e=>e.includes('engine')));
test('pinned nvm rejected',d=>writeFileSync(join(d,'.nvmrc'),'20\n'),errors=>errors.some(e=>e.includes('.nvmrc')));
test('malformed metadata rejected',d=>writeFileSync(join(d,'package.json'),'{'),errors=>errors.some(e=>e.includes('malformed:')));
const source=readFileSync(new URL('./require-node22.mjs',import.meta.url),'utf8');
assert.match(source,/MINIMUM_NODE_MAJOR = 20/);
assert.doesNotMatch(source,/TESTED_NODE_MAJORS/);
console.log('PASS: Node 20+ floating contract negative tests');
