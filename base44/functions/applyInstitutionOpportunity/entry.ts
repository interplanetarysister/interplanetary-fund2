import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Submits a grant application. Creates the GrantApplication as the user and
// increments the opportunity's application_count as the service role
// (InstitutionOpportunity.update is owner-only under RLS). Dedupes one
// application per user per opportunity and notifies the opportunity publisher.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to apply.' }, { status: 401 });

    const body = await req.json();
    const { opportunity_id, institution_id, campaign_id, campaign_title, narrative, requested_amount } = body;
    if (!opportunity_id || !institution_id || !campaign_id || !narrative || !narrative.trim()) {
      return Response.json({ error: 'Missing application details' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const opp = await sr.entities.InstitutionOpportunity.get(opportunity_id).catch(() => null);
    if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    if (opp.status !== 'open') return Response.json({ error: 'This opportunity is no longer open.' }, { status: 400 });
    const institution = await sr.entities.Institution.get(institution_id).catch(() => null);
    if (!institution) return Response.json({ error: 'Institution not found' }, { status: 404 });

    const mine = await sr.entities.GrantApplication.filter({ opportunity_id, applicant_user_id: user.id });
    if (mine && mine.length) return Response.json({ error: 'You already applied to this opportunity.' }, { status: 400 });

    const application = await base44.entities.GrantApplication.create({
      opportunity_id,
      opportunity_title: opp.title,
      institution_id,
      institution_name: institution.name,
      campaign_id,
      campaign_title,
      applicant_name: user.full_name || user.email,
      applicant_user_id: user.id,
      narrative,
      requested_amount: requested_amount ? Number(requested_amount) : undefined,
      status: 'submitted',
    });
    // Atomic increment — avoids the read-modify-write race on concurrent applications.
    await sr.entities.InstitutionOpportunity.updateMany(
      { id: opportunity_id },
      { $inc: { application_count: 1 } }
    );

    if (opp.created_by_id && opp.created_by_id !== user.id) {
      await sr.entities.Notification.create({
        user_id: opp.created_by_id,
        title: 'New application received',
        body: `${campaign_title || 'A campaign'} applied to "${opp.title}"`,
        type: 'system',
        link: `/institutions/${institution_id}`,
      });
    }
    return Response.json({ application });
  } catch (error) {
    console.error('applyInstitutionOpportunity error:', error.message);
    return Response.json({ error: 'Unable to submit your application. Please try again.' }, { status: 500 });
  }
}