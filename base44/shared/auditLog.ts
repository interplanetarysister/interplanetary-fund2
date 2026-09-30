// Lightweight audit-logging helper. Writes an AuditLog record via the service
// role so it works from any backend function. Failures are logged but never
// thrown — audit logging must not break the calling operation.

const SENSITIVE_METADATA_KEY = /(token|secret|password|credential|authorization|cookie|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token|amount|balance|iban|account[_-]?number|routing)/i;
const MAX_METADATA_DEPTH = 3;
const MAX_METADATA_KEYS = 32;
const MAX_METADATA_ARRAY = 32;
const MAX_METADATA_STRING = 500;

function sanitizeAuditMetadata(value, depth = 0) {
  if (depth > MAX_METADATA_DEPTH) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') return value.slice(0, MAX_METADATA_STRING);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_METADATA_ARRAY).map((item) => sanitizeAuditMetadata(item, depth + 1));
  }
  if (typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_METADATA_KEYS)) {
      if (SENSITIVE_METADATA_KEY.test(key)) {
        output[key] = '[redacted]';
      } else {
        output[key] = sanitizeAuditMetadata(item, depth + 1);
      }
    }
    return output;
  }
  return '[omitted]';
}

function classifyAuditFailure(error) {
  if (error instanceof TypeError) return 'type_error';
  if (error instanceof RangeError) return 'range_error';
  if (error instanceof SyntaxError) return 'syntax_error';
  if (error instanceof Error) return 'error';
  if (typeof error === 'string') return 'thrown_string';
  if (error == null) return 'unknown';
  return 'thrown_value';
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
      metadata: sanitizeAuditMetadata(entry.metadata || {}),
    });
  } catch (error) {
    console.error('logAudit failed:', classifyAuditFailure(error));
  }
}
