import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import { Block, Transaction } from 'bitcoinjs-lib';
import * as v from 'valibot';
import { Connection, PublicKey } from '@solana/web3.js';
import { AddressPurpose, connectRequestMessageSchema, getAccountsParamsSchema, getBalanceResultSchema } from '@sats-connect/core';

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
for (const [name, version] of Object.entries({
  'bitcoinjs-lib': '6.1.10', axios: '1.21.1', 'follow-redirects': '1.16.3',
  '@grpc/grpc-js': '1.14.7', jayson: '5.0.0', vite: '6.4.6', '@sats-connect/core': '0.6.11', valibot: '1.5.0',
})) assert.equal(lock.packages[`node_modules/${name}`]?.version, version, `${name} must remain on the reviewed patch`);

// GHSA-8vv3-6qpc-gpw6: odd-leaf padding must not let an explicitly
// duplicated transaction list validate against the same legitimate root.
const transactions = [1, 2, 3].map(version => { const tx = new Transaction(); tx.version = version; return tx; });
const block = new Block();
block.transactions = transactions;
block.merkleRoot = Block.calculateMerkleRoot(transactions);
assert.equal(block.checkTxRoots(), true, 'legitimate odd transaction count remains valid');
block.transactions = [...transactions, transactions[2]];
assert.deepEqual(Block.calculateMerkleRoot(block.transactions), block.merkleRoot);
assert.equal(block.checkTxRoots(), false, 'explicit duplicate merkle leaf must invalidate a block');

// Exercise the Sats wallet schemas with the patched core/Valibot peer instead
// of assuming successful module resolution proves runtime API compatibility.
assert.equal(v.safeParse(connectRequestMessageSchema, {
  jsonrpc: '2.0', id: 'local-check', method: 'wallet_connect',
  params: { addresses: [AddressPurpose.Payment], message: 'Local compatibility check' },
}).success, true);
assert.equal(v.safeParse(connectRequestMessageSchema, {
  jsonrpc: '2.0', id: 'local-check', method: 'wallet_connect', params: { message: 'x'.repeat(81) },
}).success, false, 'wallet message bounds remain enforced');
assert.equal(v.safeParse(getAccountsParamsSchema, { purposes: [AddressPurpose.Payment] }).success, true);
assert.equal(v.safeParse(getAccountsParamsSchema, { purposes: ['unrecognized-purpose'] }).success, false);
assert.equal(v.safeParse(getBalanceResultSchema, { confirmed: '100', unconfirmed: '0', total: '100' }).success, true);
assert.equal(v.safeParse(getBalanceResultSchema, { confirmed: 100, unconfirmed: '0', total: '100' }).success, false);
// GHSA-5qjj-4xww-7phc: invalid records with inherited Object property names
// must produce usable errors, rather than throwing while flattening them.
for (const key of ['toString', 'valueOf', 'hasOwnProperty']) {
  const invalid = v.safeParse(v.record(v.string(), v.string()), JSON.parse(`{"${key}":42}`));
  assert.equal(invalid.success, false);
  assert.doesNotThrow(() => v.flatten(invalid.issues));
}

// Jayson 5 retains the CommonJS browser transport used by Solana and uses
// native UUID generation instead of its old UUID/stream-json dependencies.
const require = createRequire(import.meta.url);
const clientRequire = createRequire(require.resolve('jayson/lib/client/browser'));
assert.equal(clientRequire('jayson/package.json').version, '5.0.0');
const ClientBrowser = clientRequire('jayson/lib/client/browser');
const client = new ClientBrowser((text, callback) => {
  const request = JSON.parse(text);
  assert.match(request.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  callback(null, JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { value: 'local' } }));
});
const response = await new Promise((resolve, reject) => client.request('local_read_only', [], (error, result) => error ? reject(error) : resolve(result)));
assert.deepEqual(response.result, { value: 'local' });
let rpcRequests = 0;
const connection = new Connection('http://127.0.0.1:4498', { fetch: async (_url, options) => {
  ++rpcRequests;
  const request = JSON.parse(options.body);
  assert.equal(request.method, 'getBalance');
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { context: { slot: 1 }, value: 100 } }), { headers: { 'Content-Type': 'application/json' } });
} });
assert.equal(await connection.getBalance(new PublicKey('11111111111111111111111111111111')), 100);
assert.equal(rpcRequests, 1, 'Solana must use the stub transport; no external RPC');

// The remaining bigint-buffer advisory affects its native Node binding.
// Prove the actual frontend resolver selects its distinct pure-JS browser
// implementation, and Solana's browser RPC client rather than a Node server.
const vite = await createViteServer({ configFile: false, server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const importer = fileURLToPath(new URL('../node_modules/@solana/buffer-layout-utils/lib/esm/bigint.js', import.meta.url));
  assert.match((await vite.pluginContainer.resolveId('bigint-buffer', importer))?.id || '', /bigint-buffer\/dist\/browser\.js$/);
  const web3 = await vite.pluginContainer.resolveId('@solana/web3.js', fileURLToPath(new URL('../src/lib/reownWallet.js', import.meta.url)));
  assert.match(web3?.id || '', /index\.browser\.esm\.js$/);
  assert.match((await vite.pluginContainer.resolveId('jayson/lib/client/browser', web3.id))?.id || '', /jayson\/lib\/client\/browser\/index\.js$/);
} finally { await vite.close(); }

// The SDK's patched Axios transport still handles local JSON responses and
// rejects responses exceeding its declared byte limit. No external requests.
const server = createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ value: req.url === '/large' ? 'x'.repeat(1000) : 'ok' })); });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual((await axios.get(origin, { proxy: false, timeout: 2000 })).data, { value: 'ok' });
  await assert.rejects(axios.get(origin + '/large', { proxy: false, maxContentLength: 64, timeout: 2000 }), /maxContentLength/);
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
console.log('PASS dependency security compatibility: duplicate-merkle rejection, Sats/Valibot valid and invalid wallet schemas, safe record errors, Jayson/Solana local RPC transport, browser-only bigint resolution, local Axios JSON and byte limits; no provider requests.');
