import assert from 'node:assert/strict';
import { confirmedMinimum, findConfirmedEngineBlockers } from './verify-locked-node20-engines.mjs';

assert.deepEqual(confirmedMinimum('>=24.12.0'), [24, 12, 0]);
assert.deepEqual(confirmedMinimum('>= 22'), [22, 0, 0]);
assert.equal(confirmedMinimum('^20.9.0 || >=22'), null);
assert.equal(confirmedMinimum('>=20 <25'), null);

const lock = { packages: {
  '': { engines: { node: '>=20' } },
  'node_modules/@capacitor/cli': { version: '8.4.3', engines: { node: '>=22.0.0' } },
  'node_modules/@firebase/ai': { version: '3.0.0', engines: { node: '>=24.12.0' } },
  'node_modules/supported': { version: '1.0.0', engines: { node: '>=20.18.0' } },
  'node_modules/complex': { version: '1.0.0', engines: { node: '^20.9.0 || >=22' } },
} };
const blockers = findConfirmedEngineBlockers(lock, '20.20.2');
assert.deepEqual(blockers.map(item => item.package), ['@capacitor/cli', '@firebase/ai']);
assert.deepEqual(findConfirmedEngineBlockers(lock, '24.22.0'), []);
assert.throws(() => findConfirmedEngineBlockers(lock, 'twenty'), /Invalid target Node version/);
console.log('PASS: locked Node engine compatibility diagnostics');
