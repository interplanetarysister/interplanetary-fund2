import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Joins or leaves a community. The membership record is written as the user so
// the author owns it under RLS, and the community's member_count is updated as
// the service role — Community.update is owner-only under RLS, so a joining
// member could not write the counter directly.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to join or leave a community.' }, { status: 401 });

    const { action, community_id } = await req.json();
    if (!community_id) return Response.json({ error: 'Missing community_id' }, { status: 400 });

    const sr = base44.asServiceRole;
    const community = await sr.entities.Community.get(community_id).catch(() => null);
    if (!community) return Response.json({ error: 'Community not found' }, { status: 404 });

    if (action === 'leave') {
      const members = await sr.entities.CommunityMember.filter({ community_id, user_id: user.id });
      const m = members && members[0];
      if (!m) return Response.json({ error: 'You are not a member of this community.' }, { status: 400 });
      await base44.entities.CommunityMember.delete(m.id);
      // Atomic decrement — avoids the read-modify-write race on concurrent
      // leaves. The member-existence check above prevents going below zero
      // in normal operation; one member leaving = one decrement.
      await sr.entities.Community.updateMany(
        { id: community_id },
        { $inc: { member_count: -1 } }
      );
      return Response.json({ ok: true });
    }

    // join (default)
    const existing = await sr.entities.CommunityMember.filter({ community_id, user_id: user.id });
    if (existing && existing.length) return Response.json({ error: 'You are already a member.' }, { status: 400 });
    await base44.entities.CommunityMember.create({
      community_id,
      user_id: user.id,
      user_name: user.full_name || user.email,
      role: 'member',
    });
    // Atomic increment — avoids the read-modify-write race on concurrent joins.
    await sr.entities.Community.updateMany(
      { id: community_id },
      { $inc: { member_count: 1 } }
    );
    return Response.json({ ok: true });
  } catch (error) {
    console.error('communityMembership error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}