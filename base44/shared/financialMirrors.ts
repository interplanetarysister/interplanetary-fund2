// Application-layer financial mirrors. Convex is the financial authority;
// Base44 Donation/Notification rows exist so current UI surfaces keep working.
// Every mirror is keyed by canonical_operation_id and reconciled to exactly one
// row. This allows replay to repair a crash between the canonical transaction
// and application side effects without re-applying money.

function stableOrder(rows) {
  return [...(rows || [])].sort((a, b) => {
    const at = new Date(a.created_date || 0).getTime();
    const bt = new Date(b.created_date || 0).getTime();
    if (at !== bt) return at - bt;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

async function reconcileOne(entity, canonicalOperationId, data) {
  const key = String(canonicalOperationId || '');
  if (!key) throw new Error('Canonical operation id is required for a financial mirror.');

  let rows = await entity.filter({ canonical_operation_id: key }).catch(() => []);
  let primary = stableOrder(rows)[0] || null;
  if (!primary) {
    primary = await entity.create({ ...data, canonical_operation_id: key });
  } else {
    await entity.update(primary.id, { ...data, canonical_operation_id: key });
  }

  // A concurrent recovery may have created a second mirror between our first
  // read and create. Re-read and deterministically retain the oldest row. Both
  // competing handlers make the same choice, so this converges to one record.
  rows = await entity.filter({ canonical_operation_id: key }).catch(() => []);
  const ordered = stableOrder(rows);
  const keep = ordered[0] || primary;
  for (const duplicate of ordered.slice(1)) {
    await entity.delete(duplicate.id).catch(() => {});
  }
  return keep;
}

export async function reconcileDonationMirror(sr, canonicalOperationId, data) {
  return reconcileOne(sr.entities.Donation, canonicalOperationId, data);
}

export async function reconcileNotificationMirror(sr, canonicalOperationId, data) {
  return reconcileOne(sr.entities.Notification, canonicalOperationId, data);
}
