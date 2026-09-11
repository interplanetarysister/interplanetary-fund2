import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MAX_ID_LENGTH = 128;
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function diagnosticType(error) {
  if (error instanceof Error) return error.name || 'Error';
  if (error === null) return 'null';
  return typeof error;
}

// Lists grant applications for an institution — only the institution's owner
// (or an admin) may read them. Service-scoped after an ownership check.
export default async function(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', Allow: 'POST' },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const keys = Object.keys(body);
    if (keys.some((key) => key !== 'institution_id')) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const institutionId = typeof body.institution_id === 'string' ? body.institution_id.trim() : '';
    if (!institutionId || institutionId.length > MAX_ID_LENGTH || !ID_PATTERN.test(institutionId)) {
      return Response.json({ error: 'Invalid institution_id' }, { status: 400 });
    }

    const institution = await base44.asServiceRole.entities.Institution.get(institutionId);
    if (!institution || institution.created_by_id !== user.id) {
      return Response.json({ error: 'Not authorized for this institution' }, { status: 403 });
    }

    const applications = await base44.asServiceRole.entities.GrantApplication.filter(
      { institution_id: institutionId },
      '-created_date',
    );
    return Response.json({ applications });
  } catch (error) {
    console.error('listInstitutionApplications failed', { type: diagnosticType(error) });
    return Response.json({ error: 'Unable to load applications. Please try again.' }, { status: 500 });
  }
}
