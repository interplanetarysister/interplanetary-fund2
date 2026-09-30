import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MAX_ID_LENGTH = 128;
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_APPLICATIONS = 500;
const MAX_TEXT_LENGTH = 2000;
const MAX_AMOUNT = 1_000_000_000;

function diagnosticType(error) {
  if (error instanceof Error) return error.name || 'Error';
  if (error === null) return 'null';
  return typeof error;
}

function boundedText(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, MAX_TEXT_LENGTH) : value;
}

function validId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH && ID_PATTERN.test(value);
}

function validDate(value) {
  return value === null || (typeof value === 'string' && value.length <= 64 && !/[\u0000-\u001F\u007F]/.test(value));
}

function projectApplication(application) {
  if (!application || typeof application !== 'object' || Array.isArray(application)) return null;
  if (!validId(application.id) || !validId(application.institution_id)) return null;
  if (typeof application.status !== 'string' || typeof application.title !== 'string' || typeof application.description !== 'string') return null;
  if (!validDate(application.created_date) || !validDate(application.updated_date)) return null;
  if (application.decision !== null && typeof application.decision !== 'string') return null;
  if (typeof application.amount_requested !== 'number' || !Number.isFinite(application.amount_requested)
    || application.amount_requested < 0 || application.amount_requested > MAX_AMOUNT) return null;

  return {
    id: application.id,
    institution_id: application.institution_id,
    status: boundedText(application.status),
    created_date: application.created_date,
    updated_date: application.updated_date,
    title: boundedText(application.title),
    description: boundedText(application.description),
    amount_requested: application.amount_requested,
    decision: application.decision === null ? null : boundedText(application.decision),
  };
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
