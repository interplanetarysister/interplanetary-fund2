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
const SAFE_STATUS = new Set(['success', 'failure', 'pending', 'denied', 'cancelled']);
const MAX_IDENTIFIER_LENGTH = 120;
const MAX_DETAIL_LENGTH = 400;
const SENSITIVE_VALUE = /(bearer\s+|sk-[a-z0-9]|token|secret|password|passwd|api[_-]?key|@)/i;

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
      .map(([key, value]) => [key, typeof value === 'string' ? sanitizeText(value, 200) : value])
      .filter(([, value]) => value !== '')
  );
}

function sanitizeText(value, maxLength) {
  const text = String(value ?? '').trim();
  if (!text || SENSITIVE_VALUE.test(text)) return '';
  return text.replace(/[^a-zA-Z0-9 ._:/-]/g, '').slice(0, maxLength);
}

function sanitizeIdentifier(value) {
  return sanitizeText(value, MAX_IDENTIFIER_LENGTH);
}

function sanitizeDetail(value) {
  return sanitizeText(value, MAX_DETAIL_LENGTH);
}

function sanitizeStatus(value) {
  const status = String(value || 'success').trim().toLowerCase();
  return SAFE_STATUS.has(status) ? status : 'failure';
}

export async function logAudit(base44, entry) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      action: sanitizeIdentifier(entry.action) || 'unknown',
      actor_user_id: sanitizeIdentifier(entry.actor_user_id),
      target_type: sanitizeIdentifier(entry.target_type),
      target_id: sanitizeIdentifier(entry.target_id),
      detail: sanitizeDetail(entry.detail),
      status: sanitizeStatus(entry.status),
      metadata: sanitizeMetadata(entry.metadata),
    });
  } catch (error) {
    console.error('logAudit failed:', diagnosticType(error));
  }
}
