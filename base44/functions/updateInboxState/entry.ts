import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Recipient state only. Saving a draft never sends/publishes a communication.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await assertActiveAccount(base44);
    if (!access.ok) return Response.json({ error: access.error }, { status: access.status });
    const body = await req.json().catch(() => null);
    const allowed = { save_draft: ['action', 'id', 'draft'], complete: ['action', 'id'],
      read_notification: ['action', 'id'], read_all_notifications: ['action'] };
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !Object.hasOwn(allowed, body.action) ||
        Object.keys(body).some((key) => !allowed[body.action].includes(key))) {
      return Response.json({ error: 'Invalid inbox request.' }, { status: 400 });
    }
    const sr = base44.asServiceRole;
    const userId = access.user.id;
    if (body.action === 'read_all_notifications') {
      const result = await sr.entities.Notification.updateMany({ user_id: userId, read: false }, { $set: { read: true } });
      if (result?.success !== true) throw new Error('Notification update failed');
      return Response.json({ success: true, has_more: result?.has_more === true });
    }
    if (typeof body.id !== 'string' || !body.id.trim() || body.id.length > 200) {
      return Response.json({ error: 'Invalid inbox request.' }, { status: 400 });
    }
    if (body.action === 'save_draft' &&
        (typeof body.draft !== 'string' || body.draft.length > 5000)) {
      return Response.json({ error: 'Draft must be at most 5,000 characters.' }, { status: 400 });
    }
    const entity = body.action === 'read_notification' ? sr.entities.Notification : sr.entities.InboxItem;
    const item = await entity.get(body.id).catch((error) => {
      if (error?.status === 404 || error?.response?.status === 404) return null;
      throw error;
    });
    // Administrators use their own recipient state here, never an admin bypass.
    if (!item || item.user_id !== userId) {
      return Response.json({ error: 'Inbox item unavailable.' }, { status: 404 });
    }
    if (body.action === 'read_notification') {
      if (item.read !== true) await entity.update(item.id, { read: true });
    } else {
      if (item.status !== 'open' && item.status !== 'done') {
        return Response.json({ error: 'Inbox item cannot be updated in its current state.' }, { status: 409 });
      }
      if (body.action === 'complete') {
        if (item.status !== 'done') await entity.update(item.id, { status: 'done' });
      } else {
        // Persist plain text, retaining tabs/newlines while removing control characters.
        const draft = body.draft.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
        if (item.ai_draft !== draft) await entity.update(item.id, { ai_draft: draft });
        return Response.json({ success: true, draft });
      }
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Unable to update inbox. Please try again.' }, { status: 500 });
  }
}
