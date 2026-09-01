// Lightweight audit-logging helper. Writes an AuditLog record via the service
// role so it works from any backend function. Failures are logged but never
// thrown — audit logging must not break the calling operation.
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
  } catch (e) {
    console.error('logAudit failed:', e && e.message ? e.message : e);
  }
}