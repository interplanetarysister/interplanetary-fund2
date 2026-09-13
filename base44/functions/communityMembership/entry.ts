import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MAX_ID_LENGTH = 128;
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

function safeDiagnostic(error) {
  if (error && typeof error === 'object') {
    const name = typeof error.name === 'string' ? error.name : '';
    if (name === 'AbortError') return 'abort';
    if (name === 'TypeError') return 'type_error';
    if (name === 'SyntaxError') return 'syntax_error';
  }
  return typeof error === 'string' ? 'string_throw' : 'unknown';
}

function jsonError(error, status) {
  return Response.json({ error }, { status });
}

export default async function(req) {
  try {
    if (req?.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
        status: 405,
        headers: { 'content-type': 'application/json', allow: 'POST' },
      });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonError('Sign in to join or leave a community.', 401);

    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonError('Invalid request body.', 400);
    }
    const keys = Object.keys(body);
    if (keys.some((key) => key !== 'action' && key !== 'community_id')) {
      return jsonError('Invalid request body.', 400);
    }

    const action = body.action === undefined ? 'join' : body.action;
    if (action !== 'join' && action !== 'leave') return jsonError('Invalid action.', 400);

    const communityId = typeof body.community_id === 'string' ? body.community_id.trim() : '';
    if (!communityId || communityId.length > MAX_ID_LENGTH || !SAFE_ID.test(communityId)) {
      return jsonError('Invalid community_id.', 400);
    }

    const sr = base44.asServiceRole;
    let community;
    try {
      community = await sr.entities.Community.get(communityId);
    } catch (error) {
      console.error('communityMembership dependency failure:', safeDiagnostic(error));
      return jsonError('Unable to update your community membership. Please try again.', 503);
    }
    if (!community) return jsonError('Community not found.', 404);

    if (action === 'leave') {
      let members;
      try {
        members = await sr.entities.CommunityMember.filter({ community_id: communityId, user_id: user.id });
      } catch (error) {
        console.error('communityMembership dependency failure:', safeDiagnostic(error));
        return jsonError('Unable to update your community membership. Please try again.', 503);
      }
      const m = Array.isArray(members) ? members[0] : null;
      if (!m || typeof m.id !== 'string' || !m.id) return jsonError('You are not a member of this community.', 400);
      await base44.entities.CommunityMember.delete(m.id);
      await sr.entities.Community.updateMany({ id: communityId }, { $inc: { member_count: -1 } });
      return Response.json({ ok: true });
    }

    let existing;
    try {
      existing = await sr.entities.CommunityMember.filter({ community_id: communityId, user_id: user.id });
    } catch (error) {
      console.error('communityMembership dependency failure:', safeDiagnostic(error));
      return jsonError('Unable to update your community membership. Please try again.', 503);
    }
    if (Array.isArray(existing) && existing.length) return jsonError('You are already a member.', 400);

    await base44.entities.CommunityMember.create({
      community_id: communityId,
      user_id: user.id,
      user_name: typeof user.full_name === 'string' && user.full_name ? user.full_name : user.email,
      role: 'member',
    });
    await sr.entities.Community.updateMany({ id: communityId }, { $inc: { member_count: 1 } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('communityMembership error:', safeDiagnostic(error));
    return jsonError('Unable to update your community membership. Please try again.', 500);
  }
}
