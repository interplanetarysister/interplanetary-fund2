// Read-only, no-network migration parity checker.
// Run: node host/migration/check-content-parity.mjs
// This does not execute a workflow, access credentials, or change a database.
import { STAGED_CONTENT, SOURCE_COUNTS, ACTIVATION_BLOCKERS } from './content-parity-manifest.mjs';

const checked = Object.entries(SOURCE_COUNTS)
  .filter(([entity]) => Object.hasOwn(STAGED_CONTENT, entity))
  .map(([entity, source]) => {
    const staged = STAGED_CONTENT[entity];
    return { entity, source, staged, missing: Math.max(0, source - staged), complete: source === staged };
  });
const incomplete = checked.filter(x => !x.complete);
console.log(JSON.stringify({
  checkedEntityTypes: checked.length,
  countParity: incomplete.length === 0,
  incomplete,
  activationBlockers: ACTIVATION_BLOCKERS,
  safeToUnpublishBase44: false,
}, null, 2));
if (incomplete.length) process.exitCode = 1;
