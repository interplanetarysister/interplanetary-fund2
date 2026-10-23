/**
 * Read-only, secret-free comparison of Base44 campaign records with the
 * non-authoritative IFund Supabase migration shadow. Never writes, imports,
 * activates, or infers financial authority from either snapshot.
 *
 * Inputs are already authorized, in-memory records. The returned report
 * includes record IDs and field NAMES only, never private field values.
 */
const CONTENT = Object.freeze([
  'status', 'title', 'summary', 'story', 'category', 'goal_amount',
  'cover_image_url', 'end_date', 'location', 'location_lat', 'location_lng',
  'cashapp_tag', 'distribution_donation_connection_id',
  'accept_crypto_donations', 'ai_profile', 'story_versions',
  'outreach_enabled', 'outreach_paused', 'draft_step',
]);
const OPERATIONAL = Object.freeze([
  'outreach_last_run_at', 'outreach_last_attempt_at', 'outreach_last_error',
  'social_last_generated_at', 'social_last_generation_attempt_at',
]);
const NUMBER = new Set(['goal_amount', 'location_lat', 'location_lng', 'draft_step']);
const DATE = new Set(['end_date']);
const BOOL = new Set(['accept_crypto_donations', 'outreach_enabled', 'outreach_paused']);
const JSON_FIELDS = new Set(['ai_profile', 'story_versions']);
const idOK = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value);

function normalized(value, field) {
  if (value == null) return null;
  if (NUMBER.has(field)) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  if (DATE.has(field) && typeof value === 'string') return value.slice(0, 10);
  if (BOOL.has(field) && (value === true || value === false)) return value;
  if (JSON_FIELDS.has(field)) return canonical(value);
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])]),
  );
  return value;
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return null;
  const iso = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + 'Z';
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : null;
}
function buildMap(records, idField) {
  if (!Array.isArray(records)) throw new TypeError('Campaign records must be arrays');
  const map = new Map();
  for (const row of records) {
    const id = row?.[idField];
    if (!idOK(id) || map.has(id)) throw new TypeError('Invalid or duplicate campaign ID');
    map.set(id, row);
  }
  return map;
}
const differs = (a, b, field) => JSON.stringify(normalized(a, field)) !== JSON.stringify(normalized(b, field));

/** Fail-closed audit; it does not authorize any synchronization. */
export function auditCampaignParity(sourceRows, shadowRows) {
  const source = buildMap(sourceRows, 'id');
  const shadow = buildMap(shadowRows, 'source_id');
  const missing = [], orphaned = [], stale = [], contentDrift = [], operationalDrift = [], ownerDrift = [], timestampErrors = [];
  for (const [id, row] of source) {
    const staged = shadow.get(id);
    if (!staged) { missing.push(id); continue; }
    if (row.created_by_id !== staged.source_owner_id) ownerDrift.push(id);
    const sourceTime = timestamp(row.updated_date);
    const shadowTime = timestamp(staged.source_updated_at);
    if (sourceTime === null || shadowTime === null || shadowTime > sourceTime) timestampErrors.push(id);
    else if (sourceTime > shadowTime) stale.push(id);
    const changedContent = CONTENT.filter(field => differs(row[field], staged[field], field));
    const changedOperational = OPERATIONAL.filter(field => differs(row[field], staged[field], field));
    if (changedContent.length) contentDrift.push({ id, fields: changedContent });
    if (changedOperational.length) operationalDrift.push({ id, fields: changedOperational });
    // Snapshot money is NEVER authoritative. This is an invariant, not a field comparison.
    if (staged.financial_authoritative !== false) throw new TypeError('Financial authority violation');
  }
  for (const id of shadow.keys()) if (!source.has(id)) orphaned.push(id);
  for (const list of [missing, orphaned, stale, ownerDrift, timestampErrors]) list.sort();
  for (const list of [contentDrift, operationalDrift]) list.sort((a, b) => a.id.localeCompare(b.id));
  return {
    sourceCount: source.size, shadowCount: shadow.size,
    missing, orphaned, stale, ownerDrift, timestampErrors, contentDrift, operationalDrift,
    financialAuthorityVerified: false,
    cutoverReady: false,
    reason: 'Audit-only; ownership, finance, agent, and live execution parity must be independently verified',
  };
}
