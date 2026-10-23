/**
 * Read-only IFund Base44 agent-history migration audit.
 * Never imports records, links owners, grants permissions or starts agents.
 * Output is aggregate-only: no identifiers, descriptions, credentials or content.
 * Historic delegations are quarantined until independent identity and fresh
 * authorization are verified, regardless of their source execution status.
 */
const asArray = value => Array.isArray(value) ? value : [];
const tally = (rows, key) => rows.reduce((counts, row) => {
  const value = typeof row?.[key] === 'string' && row[key] ? row[key] : 'unset';
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, Object.create(null));
const isUserScope = value => typeof value === 'string' && value.startsWith('user:');
const isAdminScope = value => typeof value === 'string' && value.startsWith('admin:');
const isValidId = value => typeof value === 'string' && value.length > 0;

export function auditAgentHistory({ campaigns, activities, delegations } = {}) {
  const cs = asArray(campaigns), as = asArray(activities), ds = asArray(delegations);
  const campaignOwner = new Map(cs.filter(c => isValidId(c?.id)).map(c => [c.id, c.created_by_id]));
  const knownOwners = new Set(cs.map(c => c?.created_by_id).filter(isValidId));
  const allHistory = [...as, ...ds];
  const scoped = { user: 0, admin: 0 };
  let missingCampaignReferences = 0, ownerMismatches = 0, unknownOwnerReferences = 0;
  for (const record of allHistory) {
    const ref = record?.campaign_id;
    if (isValidId(ref) && !campaignOwner.has(ref)) {
      if (isUserScope(ref)) scoped.user++;
      else if (isAdminScope(ref)) scoped.admin++;
      else missingCampaignReferences++;
    }
    if (campaignOwner.has(ref) && isValidId(record?.owner_user_id) &&
        campaignOwner.get(ref) !== record.owner_user_id) ownerMismatches++;
    if (!knownOwners.has(record?.owner_user_id)) unknownOwnerReferences++;
  }
  const missingConsentVersion = ds.filter(d => !isValidId(d?.consent_version)).length;
  const atRetryLimit = ds.filter(d => Number.isInteger(d?.retry_count) &&
    Number.isInteger(d?.max_retries) && d.retry_count === d.max_retries).length;
  const overRetryLimit = ds.filter(d => Number.isInteger(d?.retry_count) &&
    Number.isInteger(d?.max_retries) && d.retry_count > d.max_retries).length;
  const missingRetryLimit = ds.filter(d => !Number.isInteger(d?.max_retries)).length;
  const ids = allHistory.map(x => x?.id).filter(isValidId);
  const duplicateRecordIds = ids.length - new Set(ids).size;
  return {
    campaignCount: cs.length,
    activityCount: as.length,
    delegationCount: ds.length,
    activityStatuses: tally(as, 'status'),
    delegationStatuses: tally(ds, 'status'),
    scopedReferences: scoped,
    missingCampaignReferences,
    ownerMismatches,
    unknownOwnerReferences,
    duplicateRecordIds,
    missingConsentVersion,
    atRetryLimit,
    overRetryLimit,
    missingRetryLimit,
    migrationDisposition: 'quarantine_only',
    executionAllowed: false,
    blockers: [
      'destination_owner_identity_not_verified',
      'agent_consent_not_revalidated',
      'agent_runtime_not_independent',
      'financial_and_cutover_parity_not_verified',
    ],
  };
}
