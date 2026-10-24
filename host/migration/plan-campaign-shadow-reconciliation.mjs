/**
 * Zero-write planning for IFund Base44 -> Supabase campaign shadows.
 * The plan is NOT an import, authorization, payment instruction, or cutover gate.
 * It deliberately emits only campaign IDs, changed field names, and blockers;
 * source text, AI profiles, financial values, and credentials are never emitted.
 */
const OPTIONAL = Object.freeze([
  'accept_crypto_donations', 'ai_profile', 'story_versions',
  'outreach_enabled', 'outreach_paused', 'draft_step',
]);
const OPERATIONAL = Object.freeze([
  'outreach_last_run_at', 'outreach_last_attempt_at',
]);
const IDENTIFIER = /^[A-Za-z0-9_-]{8,100}$/;
const SHA256 = /^[a-f0-9]{64}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hasOwn = (row, key) => Object.prototype.hasOwnProperty.call(row, key);

function rowsToMap(rows, idKey, label) {
  if (!Array.isArray(rows)) throw new TypeError(`${label} must be an array`);
  const map = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row))
      throw new TypeError(`Malformed ${label} record`);
    const id = row[idKey];
    if (typeof id !== 'string' || !IDENTIFIER.test(id) || map.has(id))
      throw new TypeError(`Invalid or duplicate ${label} ID`);
    map.set(id, row);
  }
  return map;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])]),
  );
  return value;
}
function comparable(value, field) {
  if (value == null) return null;
  if (field === 'draft_step' && typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
    return Number(value);
  return canonical(value);
}
function changed(source, shadow, field) {
  return JSON.stringify(comparable(source[field], field)) !== JSON.stringify(comparable(shadow[field], field));
}
function epoch(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return null;
  const t = Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
  return Number.isFinite(t) ? t : null;
}

/**
 * Produces a NON-EXECUTABLE, read-only report. All entries remain blocked from
 * application until independent, owner-authenticated provenance/hash checks,
 * consent and rollback evidence are available. Never outputs changed values.
 */
export function planCampaignShadowReconciliation(sourceRows, shadowRows, ownerRows) {
  const source = rowsToMap(sourceRows, 'id', 'source campaign');
  const shadow = rowsToMap(shadowRows, 'source_id', 'shadow campaign');
  const owners = rowsToMap(ownerRows, 'source_owner_id', 'owner map');
  // Fail closed on ambiguous destination identities, including case-only UUID
  // duplicates. A candidate identity is never a verified destination link.
  const destinationOwners = new Map();
  for (const owner of owners.values()) {
    const uid = owner.destination_auth_uid;
    if (owner.verification_state === 'verified') {
      if (typeof uid !== 'string' || !UUID.test(uid))
        throw new TypeError('Verified owner mapping lacks valid destination identity');
      const normalized = uid.toLowerCase();
      if (destinationOwners.has(normalized) && destinationOwners.get(normalized) !== owner.source_owner_id)
        throw new TypeError('Conflicting verified destination owner mapping');
      destinationOwners.set(normalized, owner.source_owner_id);
    } else if (uid != null) {
      throw new TypeError('Unverified owner mapping contains destination identity');
    }
  }
  // Fail closed for every shadow, including unmatched/orphaned shadows.
  for (const row of shadow.values()) {
    if (row.financial_authoritative !== false)
      throw new TypeError('Financial authority invariant violated');
  }
  const records = [];
  for (const [id, src] of source) {
    const dst = shadow.get(id);
    const blockers = [];
    if (!dst) {
      records.push({ id, optionalFields: [], operationalFields: [], blockers: ['missing_shadow'], applyAllowed: false });
      continue;
    }
    const owner = owners.get(src.created_by_id);
    if (!src.created_by_id || src.created_by_id !== dst.source_owner_id) blockers.push('source_owner_mismatch');
    if (!owner || owner.verification_state !== 'verified' ||
        typeof owner.destination_auth_uid !== 'string' || !UUID.test(owner.destination_auth_uid))
      blockers.push('owner_auth_not_verified');
    if (src.status !== dst.status) blockers.push('status_mismatch');
    if (typeof dst.source_sha256 !== 'string' || !SHA256.test(dst.source_sha256))
      blockers.push('missing_or_invalid_staged_hash');
    const st = epoch(src.updated_date), dt = epoch(dst.source_updated_at);
    if (st === null || dt === null || dt > st) blockers.push('invalid_timestamp_order');
    const optionalFields = OPTIONAL.filter(field => hasOwn(src, field) && changed(src, dst, field));
    const operationalFields = OPERATIONAL.filter(field => hasOwn(src, field) && changed(src, dst, field));
    if (optionalFields.length) blockers.push('explicit_optional_content_review');
    if (operationalFields.length) blockers.push('operational_provenance_review');
    if (st !== null && dt !== null && st > dt) blockers.push('source_newer_than_staging');
    // An owner-map record alone does not prove a live owner JWT or consent.
    blockers.push('fresh_owner_session_hash_and_rollback_evidence_required');
    records.push({ id, optionalFields, operationalFields, blockers, applyAllowed: false });
  }
  for (const id of shadow.keys()) {
    if (!source.has(id)) records.push({ id, optionalFields: [], operationalFields: [], blockers: ['orphan_shadow'], applyAllowed: false });
  }
  records.sort((a, b) => a.id.localeCompare(b.id));
  return {
    classification: 'read_only_non_executable_plan',
    sourceCount: source.size,
    shadowCount: shadow.size,
    optionalGapCount: records.filter(x => x.optionalFields.length > 0).length,
    operationalDriftCount: records.filter(x => x.operationalFields.length > 0).length,
    pendingOwnerCount: records.filter(x => x.blockers.includes('owner_auth_not_verified')).length,
    records,
    financialAuthorityVerified: false,
    liveOwnerJwtVerified: false,
    cutoverReady: false,
    anyWriteAuthorized: false,
  };
}
