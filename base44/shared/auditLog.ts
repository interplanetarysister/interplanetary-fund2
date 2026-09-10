// Lightweight audit-logging helper. Writes an AuditLog record via the service
// role so it works from any backend function. Failures are logged but never
// thrown — audit logging must not break the calling operation.
function diagnosticType(error) {
  if (error && typeof error === 'object' && typeof error.name === 'string' && error.name.trim()) {
    return error.name.trim().slice(0, 80);
  }
  return typeof error;
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
      metadata: entry.metadata || {},
    });
  } catch (error) {
    console.error('logAudit failed:', diagnosticType(error));
  }
}
