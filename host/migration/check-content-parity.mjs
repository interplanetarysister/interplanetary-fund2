// Read-only parity checker for recorded migration snapshots.
// Run: node host/migration/check-content-parity.mjs
// Source counts and staging counts are snapshots, not live queries.
// An untracked entity type is never assumed complete.
import { STAGED_CONTENT, SOURCE_COUNTS, ACTIVATION_BLOCKERS } from './content-parity-manifest.mjs';

const checked = Object.entries(SOURCE_COUNTS).map(([entity, source]) => {
  const tracked = Object.hasOwn(STAGED_CONTENT, entity);
  const staged = tracked ? STAGED_CONTENT[entity] : null;
  return { entity, source, staged, tracked,
    missing: tracked ? Math.max(0, source - staged) : null,
    complete: tracked && source === staged };
});
const incomplete = checked.filter(x => !x.complete);
const untracked = incomplete.filter(x => !x.tracked);
const mismatched = incomplete.filter(x => x.tracked);
const report = {
  sourceEntityTypes: checked.length,
  checkedEntityTypes: checked.length - untracked.length,
  countParity: incomplete.length === 0,
  untracked, mismatched,
  activationBlockers: ACTIVATION_BLOCKERS,
  safeToUnpublishBase44: false,
};
console.log(JSON.stringify(report, null, 2));
if (incomplete.length || ACTIVATION_BLOCKERS.length) process.exitCode = 1;
