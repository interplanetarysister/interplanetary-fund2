import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MAX_ID_LENGTH = 128;
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_APPLICATIONS = 500;
const MAX_TEXT_LENGTH = 2000;

function diagnosticType(error) {
  if (error instanceof Error) return error.name || 'Error';
  if (error === null) return 'null';
  return typeof error;
}

function boundedText(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, MAX_TEXT_LENGTH) : value;
}

function projectApplication(application) {
  if (!application || typeof application !== 'object' || Array.isArray(application)) return null;
  const projected = {
    id: typeof application.id === 'string' ? application.id : null,
    institution_id: typeof application.institution_id === 'string' ? application.institution_id : null,
    status: typeof application.status === 'string' ? boundedText(application.status) : null,
    created_date: typeof application.created_date === 'string' ? application.created_date : null,
    updated_date: typeof application.updated_date === 'string' ? application.updated_date : null,
    title: typeof application.title === 'string' ? boundedText(application.title) : null,
    description: typeof application.description === 'string' ? boundedText(application.description) : null,
    amount_requested: typeof application.amount_requested === 'number' && Number.isFinite(application.amount_requested)
      ? application.amount_requested
      : null,
    decision: typeof application.decision === 'string' ? boundedText(application.decision) : null,
  };
  if (!projected.id || !projected.institution_id) return null;
  return projected;
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
    if (!Array.isArray(applications) || applications.length > MAX_APPLICATIONS) {
      return Response.json({ error: 'Unable to load applications. Please try again.' }, { status: 502 });
    }
    const projectedApplications = applications.map(projectApplication);
    if (projectedApplications.some((application) => application === null)) {
      return Response.json({ error: 'Unable to load applications. Please try again.' }, { status: 502 });
    }
    return Response.json({ applications: projectedApplications });
  } catch (error) {
    console.error('listInstitutionApplications failed', { type: diagnosticType(error) });
    return Response.json({ error: 'Unable to load applications. Please try again.' }, { status: 500 });
  }
}
