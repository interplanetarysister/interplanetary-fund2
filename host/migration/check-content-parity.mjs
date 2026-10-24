// Offline parity audit over recorded snapshots; no database, network, or paid workflow.
// Run: node host/migration/check-content-parity.mjs
// Staging count parity does not prove field parity, authorization, or financial reconciliation.
import { STAGED_CONTENT, SOURCE_COUNTS, ACTIVATION_BLOCKERS } from './content-parity-manifest.mjs';

// Counts verified from other private Supabase migration tables on 2026-10-24.
// Owner identity mappings are NOT interchangeable with migrated User records.
const OTHER_STAGED = Object.freeze({
  Campaign: 27, CampaignUpdate: 10, PlatformConnection: 32,
});
const checked = Object.entries(SOURCE_COUNTS).map(([entity, source]) => {
  const content = Object.hasOwn(STAGED_CONTENT, entity);
  const other = Object.hasOwn(OTHER_STAGED, entity);
  const staged = content ? STAGED_CONTENT[entity] : other ? OTHER_STAGED[entity] : null;
  const location = content ? 'content_shadow' : other ? 'other_private_staging' : 'untracked';
  return {
    entity, source, staged, location,
    missing: staged === null ? null : Math.max(0, source - staged),
    complete: staged !== null && source === staged,
  };
});
const untracked = checked.filter(x => x.location === 'untracked');
const mismatched = checked.filter(x => x.staged !== null && !x.complete);
const report = {
  snapshotDate: '2026-10-24',
  sourceEntityTypes: checked.length,
  trackedEntityTypes: checked.length - untracked.length,
  countParity: untracked.length === 0 && mismatched.length === 0,
  untracked, mismatched,
  activationBlockers: ACTIVATION_BLOCKERS,
  safeToUnpublishBase44: false,
};
console.log(JSON.stringify(report, null, 2));
// A zero-source Donation or Withdrawal count never proves provider-ledger reconciliation.
if (!report.countParity || ACTIVATION_BLOCKERS.length) process.exitCode = 1;
