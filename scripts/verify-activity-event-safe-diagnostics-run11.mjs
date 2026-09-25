import fs from 'node:fs';

const source = fs.readFileSync('base44/shared/activityEvent.ts', 'utf8');
const required = [
  ['stable failure code', source.includes("ACTIVITY_EVENT_FAILURE = 'activity_event_write_failed'")],
  ['classifier present', source.includes('classifyActivityEventFailure')],
  ['no raw message access', !source.includes('e.message') && !source.includes('error.message')],
  ['no raw thrown interpolation', !source.includes('console.error(\'emitActivityEvent failed:\', error)')],
  ['best-effort catch remains', source.includes('} catch (error) {')],
  ['non-throwing return contract', source.includes('console.error(')],
];

const failed = required.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('ActivityEvent safe-diagnostics verifier failed:');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`ActivityEvent safe-diagnostics verifier passed (${required.length} checks).`);
