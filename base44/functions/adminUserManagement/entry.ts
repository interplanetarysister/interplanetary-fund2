import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SAFE_ERROR = 'User management action could not be completed.';
const USER_FIELDS = ['id', 'email', 'full_name', 'role', 'subscription_tier', 'subscription_status'];

function publicUser(user) {
  return USER_FIELDS.reduce((result, field) => {
    if (user?.[field] !== undefined) result[field] = user[field];
    return result;
  }, {});
}

async function requireAdmin(base44) {
  const user = await base44.auth.me();
  if (!user?.id || user.role !== 'admin') {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  return user;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    if (req.method === 'GET' || body.action === 'list') {
      const users = await sr.entities.User.list('-created_date', 200);
      return Response.json({ users: (users || []).map(publicUser) });
    }

    if (body.action === 'set_role') {
      const targetId = String(body.user_id || '').trim();
      const role = body.role === 'admin' ? 'admin' : body.role === 'user' ? 'user' : null;
      if (!targetId || !role) return Response.json({ error: 'Invalid user-management request.' }, { status: 400 });
      if (targetId === admin.id) return Response.json({ error: 'You cannot change your own role.' }, { status: 400 });

      const target = await sr.entities.User.get(targetId);
      if (!target) return Response.json({ error: 'User not found.' }, { status: 404 });

      await sr.entities.User.update(targetId, { role });
      return Response.json({ ok: true, user: publicUser({ ...target, role }) });
    }

    return Response.json({ error: 'Unsupported user-management action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('adminUserManagement error:', error);
    return Response.json({ error: SAFE_ERROR }, { status: 500 });
  }
}
