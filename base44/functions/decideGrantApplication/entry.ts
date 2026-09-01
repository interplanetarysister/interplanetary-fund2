import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Decides a grant application (award / decline / under review). Verifies the
// caller owns the institution the application belongs to before updating, then
// notifies the applicant. Service-scoped so it bypasses RLS safely.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { application_id, status, decision_note } = await req.json();
    if (!application_id || !status) return Response.json({ error: 'Missing decision details' }, { status: 400 });

    const sr = base44.asServiceRole;
    const app = await sr.entities.GrantApplication.get(application_id);
    if (!app) return Response.json({ error: 'Application not found' }, { status: 404 });

    const institution = await sr.entities.Institution.get(app.institution_id).catch(() => null);
    if (!institution || institution.created_by_id !== user.id) {
      return Response.json({ error: 'Not authorized to decide this application' }, { status: 403 });
    }

    await sr.entities.GrantApplication.update(application_id, { status, decision_note: decision_note || '' });

    // When an application is awarded, record it as an institutional donation that
    // requires admin clearing before it can be withdrawn (only on the transition
    // into 'awarded' so re-decisions don't double-count).
    if (status === 'awarded' && app.status !== 'awarded') {
      const amount = parseFloat(app.requested_amount) || 0;
      if (amount > 0 && app.campaign_id) {
        const campaign = await sr.entities.Campaign.get(app.campaign_id).catch(() => null);
        await sr.entities.Donation.create({
          campaign_id: app.campaign_id,
          campaign_title: app.campaign_title || (campaign ? campaign.title : undefined),
          amount,
          donor_name: app.institution_name || 'Institutional Grant',
          message: app.opportunity_title ? `Grant award: ${app.opportunity_title}` : 'Grant award',
          donor_user_id: app.applicant_user_id,
          payment_method: 'other',
          is_institutional: true,
          cleared: false,
        });
        if (campaign) {
          // Atomic increment — avoids the read-modify-write race on concurrent awards.
          await sr.entities.Campaign.updateMany(
            { id: campaign.id },
            { $inc: { raised_amount: amount, donor_count: 1 } }
          );
        }
      }
    }

    if (app.applicant_user_id) {
      await sr.entities.Notification.create({
        user_id: app.applicant_user_id,
        title: status === 'awarded' ? 'Your application was awarded' : `Application ${status.replace('_', ' ')}`,
        body: `${institution.name} updated your application for "${app.opportunity_title}"${decision_note ? `: ${decision_note}` : ''}`,
        type: 'system',
        link: '/institutions',
      });
    }

    return Response.json({ status, decision_note: decision_note || '' });
  } catch (error) {
    console.error('decideGrantApplication error:', error.message);
    return Response.json({ error: 'Unable to record your decision. Please try again.' }, { status: 500 });
  }
}