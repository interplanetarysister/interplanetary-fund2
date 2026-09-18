import fs from 'node:fs';

const agents = fs.readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const required = [
  ['package.json Node contract', pkg.engines?.node === '22.x'],
  ['environment notes mark exact patch versions as observations', /not a new permanent package-version pin/i.test(agents)],
  ['sandbox reset caveat', /not guaranteed to survive sandbox recreation/i.test(agents)],
  ['hosted runtime non-guarantee', /Do not claim this changes Base44's internal sync service/i.test(agents)],
  ['Deno backend distinction', /Base44 backend functions use their platform Deno runtime/i.test(agents)],
  ['operational working-directory guidance', /Run app commands from \/app/i.test(agents)],
];

const failures = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`environment-memory boundary failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('environment-memory boundary passed');
