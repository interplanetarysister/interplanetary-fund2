// Lightweight audit-logging helper. Writes an AuditLog record via the service
// role so it works from any backend function. Failures are logged but never
// thrown — audit logging must not break the calling operation.
const SAFE_METADATA_KEYS = new Set([
  'source',
  'reason',
  'status',
  'provider',
  'operation',
  'resource_type',
  'resource_id',
  'count',
  'attempt',
  'result',
  'category',
  'channel',
]);

function diagnosticType(error) {
  const name = error && typeof error === 'object' && typeof error.name === 'string'
    ? error.name.trim().toLowerCase()
    : '';
  if (name === 'typeerror' || name === 'rangeerror' || name === 'syntaxerror' || name === 'referenceerror') {
    return name;
  }
  return typeof error;
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => SAFE_METADATA_KEYS.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
      .slice(0, 20)
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 200) : value]),
  );
}

export async function logAudit(base44, entry) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      action: String(entry.action || 'unknown'),
      actor_user_id: String(entry.actor_user_id || ''),
      target_type: String(entry.target_type || ''),
      target_id: String(entry.target_id || ''),
      detail: String(entry.detail || '').slice(0, 2000),
      status: entry.status || 'success',
      metadata: sanitizeMetadata(entry.metadata),
    });
  } catch (error) {
    console.error('logAudit failed:', diagnosticType(error));
  }
}
