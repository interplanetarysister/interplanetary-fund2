import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const engine = pkg?.engines?.node;
const lockEngine = lock?.packages?.['']?.engines?.node;
expect(engine === '22.x', `package.json engines.node must remain 22.x; found ${String(engine)}`);
expect(lockEngine === '22.x', `package-lock root engines.node must remain 22.x; found ${String(lockEngine)}`);

expect(agents.includes('targets Node **22.x**, not Node 24'), 'AGENTS.md must document Node 22 as the repository-aligned major runtime contract');
expect(agents.includes('These exact patch versions are verified environment observations, not a new permanent package-version pin.'), 'AGENTS.md must mark exact Node/npm patch versions as observations, not permanent pins');
expect(agents.includes('The sandbox OS installation is not guaranteed to survive sandbox recreation.'), 'AGENTS.md must preserve the sandbox-reset caveat');
expect(agents.includes('Do not claim this changes Base44\'s internal sync service or guarantees its hosted build runtime.'), 'AGENTS.md must prevent environment notes from being treated as hosted-runtime guarantees');
expect(agents.includes('Run app commands from `/app`'), 'AGENTS.md must label `/app` as operational command guidance');

const forbiddenPermanentPin = /(?:pin|require|must|guarantee)[^\n]*(?:22\.23\.2|10\.9\.8)/i;
expect(!forbiddenPermanentPin.test(agents), 'AGENTS.md must not turn observed Node/npm patch versions into permanent requirements');

if (failures.length) {
  console.error('Environment-memory boundary verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Environment-memory boundary verification passed.');
