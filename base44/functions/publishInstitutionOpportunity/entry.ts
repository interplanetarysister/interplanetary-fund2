import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Publishes a grant/funding opportunity for an institution. Verifies the caller
// owns the institution, creates the opportunity as the user (owner = creator,
// so RLS update/delete later work for them), and increments the institution's
// opportunity_count as the service role (Institution.update is owner-only).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to publish an opportunity.' }, { status: 401 });

    const body = await req.json();
    const { institution_id, title, category, description, award_amount, eligibility, requirements, deadline } = body;
    if (!institution_id || !title) return Response.json({ error: 'A title is required.' }, { status: 400 });

    const sr = base44.asServiceRole;
    const institution = await sr.entities.Institution.get(institution_id).catch(() => null);
    if (!institution) return Response.json({ error: 'Institution not found' }, { status: 404 });
    if (institution.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the institution owner can publish opportunities.' }, { status: 403 });
    }

    const opportunity = await base44.entities.InstitutionOpportunity.create({
      institution_id,
      institution_name: institution.name,
      title,
      category: category || 'grant',
      description,
      award_amount,
      eligibility,
      requirements,
      deadline: deadline || undefined,
      status: 'open',
    });
    await sr.entities.Institution.update(institution_id, { opportunity_count: (institution.opportunity_count || 0) + 1 });
    return Response.json({ opportunity });
  } catch (error) {
    console.error('publishInstitutionOpportunity error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}