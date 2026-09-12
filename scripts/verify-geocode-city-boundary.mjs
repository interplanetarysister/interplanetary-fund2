import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/geocodeCity/entry.ts', 'utf8');
const required = [
  ['POST-only method guard', source.includes("req?.method !== 'POST'")],
  ['stable Allow header', source.includes("allow: 'POST'")],
  ['malformed body handling', source.includes("Invalid request body")],
  ['strict city validation', source.includes('MAX_CITY_LENGTH') && source.includes('hasUnsafeControls(city)')],
  ['provider row cap', source.includes('MAX_PROVIDER_ROWS')],
  ['finite coordinate validation', source.includes('Number.isFinite(lat)') && source.includes('Number.isFinite(lng)')],
  ['bounded display projection', source.includes('MAX_DISPLAY_LENGTH') && source.includes('display.length > MAX_DISPLAY_LENGTH')],
  ['bounded diagnostics', source.includes('diagnosticType(error)') && !source.includes('error.message')],
  ['safe 500 copy', source.includes('SAFE_ERROR')],
];

const failures = required.filter(([, ok]) => !ok);
if (failures.length) {
  console.error('geocodeCity boundary verifier failed:');
  for (const [name] of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`geocodeCity boundary verifier passed (${required.length} checks).`);
