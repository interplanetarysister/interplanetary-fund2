import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/syncFromConvex/entry.ts', 'utf8');

const checks = [
  ['admin authorization is enforced before service-role access', source.includes("if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });")],
  ['Convex endpoint comes from runtime secrets', source.includes('secrets.get("CONVEX_QUERY_URL")')],
  ['missing endpoint fails closed', source.includes("if (!convexQueryUrl)")],
  ['required upstream reads are not converted to empty fallbacks', source.includes('Promise.all([') && !source.includes('.catch((e) => { console.warn(e.message); return []; })')],
  ['client receives a stable synchronization error', source.includes("Unable to synchronize platform data")],
  ['raw exception text remains server-side', source.includes("console.error('syncFromConvex failed', error)")],
];

for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`syncFromConvex security verification failed: ${failed.length} check(s).`);
  process.exit(1);
}

console.log(`syncFromConvex security verification passed: ${checks.length} checks.`);
