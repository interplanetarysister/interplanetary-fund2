import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';

// Friend-account relationships using the existing user architecture. No private
// user-to-user messaging — relationships only. All actions are authorization
// checked: only the addressee can accept/decline; only participants (or admin)
// can remove. Lookup returns only a user id + display name (never email) so a
// request can be addressed without exposing private contact info.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'list';

    if (action === 'lookup') {
      const q = String(body.query || '').trim().toLowerCase();
      if (!q) return Response.json({ error: 'Enter an email or handle.' }, { status: 400 });
      const users = await sr.entities.User.list(undefined, 500).catch(() => []);
      const found = users.find((u) => (u.email || '').toLowerCase() === q || (u.handle || '').toLowerCase() === q);
      if (!found || found.id === user.id) return Response.json({ found: false });
      return Response.json({ found: true, user_id: found.id, display_name: found.full_name || 'Interplanetary Fund member' });
    }

    if (action === 'list') {
      const [outgoing, incoming] = await Promise.all([
        sr.entities.Friendship.filter({ requester_user_id: user.id }, '-requested_at', 200).catch(() => []),
        sr.entities.Friendship.filter({ addressee_user_id: user.id }, '-requested_at', 200).catch(() => []),
      ]);
      // Resolve the other party's display name (never their email) for the UI.
      const ids = new Set([...outgoing.map((f) => f.addressee_user_id), ...incoming.map((f) => f.requester_user_id)]);
      const names = {};
      for (const id of ids) {
        const u = await sr.entities.User.get(id).catch(() => null);
        if (u) names[id] = u.full_name || 'Interplanetary Fund member';
      }
      const withNames = (arr, otherKey) => arr.map((f) => ({ ...f, other_name: names[f[otherKey]] || 'Interplanetary Fund member' }));
      return Response.json({ outgoing: withNames(outgoing, 'addressee_user_id'), incoming: withNames(incoming, 'requester_user_id') });
    }

    if (action === 'request') {
      const addresseeId = body.addressee_user_id;
      if (!addresseeId) return Response.json({ error: 'A friend account is required.' }, { status: 400 });
      if (addresseeId === user.id) return Response.json({ error: "You can't friend yourself." }, { status: 400 });
      // Prevent duplicate requests in either direction.
      const a = await sr.entities.Friendship.filter({ requester_user_id: user.id, addressee_user_id: addresseeId }).catch(() => []);
      const b = await sr.entities.Friendship.filter({ requester_user_id: addresseeId, addressee_user_id: user.id }).catch(() => []);
      const existing = [...a, ...b];
      const dup = existing.find((f) => f.status === 'accepted' || f.status === 'pending');
      if (dup) return Response.json({ ok: true, duplicate: true, status: dup.status, friendship_id: dup.id });
      const fr = await sr.entities.Friendship.create({ requester_user_id: user.id, addressee_user_id: addresseeId, status: 'pending', requested_at: new Date().toISOString() });
      await logAudit(base44, { action: 'friend_request', actor_user_id: user.id, target_type: 'Friendship', target_id: fr.id, detail: 'Friend request sent', status: 'success' });
      return Response.json({ ok: true, friendship_id: fr.id, status: 'pending' });
    }

    if (action === 'accept' || action === 'decline') {
      const fr = await sr.entities.Friendship.get(body.friendship_id).catch(() => null);
      if (!fr) return Response.json({ error: 'Request not found.' }, { status: 404 });
      if (fr.addressee_user_id !== user.id) return Response.json({ error: 'Only the recipient can respond.' }, { status: 403 });
      const status = action === 'accept' ? 'accepted' : 'declined';
      await sr.entities.Friendship.update(fr.id, { status, accepted_at: action === 'accept' ? new Date().toISOString() : null });
      await logAudit(base44, { action: `friend_${action}`, actor_user_id: user.id, target_type: 'Friendship', target_id: fr.id, detail: `Friend request ${status}`, status: 'success' });
      return Response.json({ ok: true, status });
    }

    if (action === 'remove') {
      const fr = await sr.entities.Friendship.get(body.friendship_id).catch(() => null);
      if (!fr) return Response.json({ error: 'Request not found.' }, { status: 404 });
      if (fr.requester_user_id !== user.id && fr.addressee_user_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Not authorized.' }, { status: 403 });
      }
      await sr.entities.Friendship.delete(fr.id);
      await logAudit(base44, { action: 'friend_removed', actor_user_id: user.id, target_type: 'Friendship', target_id: fr.id, detail: 'Friend removed', status: 'success' });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    console.error('manageFriends error:', error.message);
    return Response.json({ error: 'Could not complete that action.' }, { status: 500 });
  }
}