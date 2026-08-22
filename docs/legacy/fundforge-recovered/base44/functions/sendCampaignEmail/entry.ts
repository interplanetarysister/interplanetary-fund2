import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function buildEmail(template, ctx) {
  const { campaign_title, campaign_url, organizer_name, amount, donor_name, milestone, days_left } = ctx;
  let subject = 'Kindred update';
  let body = '';
  const btn = (label) => `<a href="${campaign_url || '#'}">${label}</a>`;
  if (template === 'campaign_created') {
    subject = `Your campaign "${campaign_title}" is live!`;
    body = `Hi ${organizer_name || 'there'}, Your fundraiser ${campaign_title} is now live on Kindred. Share it with your community to start raising funds. ${btn('View Campaign')}`;
  } else if (template === 'donation_receipt') {
    subject = `Receipt for your $${amount} donation`;
    body = `Hi ${donor_name || 'there'}, Thank you for your generous donation of $${amount} to ${campaign_title}. Your support makes a real difference. ${btn('View Campaign')}`;
  } else if (template === 'milestone_reached') {
    subject = `Milestone reached: ${milestone} of "${campaign_title}"`;
    body = `Great news! Your campaign ${campaign_title} has reached ${milestone} of its funding goal. Keep sharing to maintain momentum. ${btn('View Campaign')}`;
  } else if (template === 'ending_soon') {
    subject = `Your campaign ends in ${days_left} hours`;
    body = `Your campaign ${campaign_title} is ending soon — about ${days_left} hours left. This is the final push to reach your goal. ${btn('View Campaign')}`;
  } else {
    body = 'You have a new update on Kindred.';
  }
  return { subject, html: body };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { template, to, campaign_title, campaign_url, amount, donor_name, organizer_name, milestone, days_left } = body;
    if (!to) return Response.json({ error: 'Missing recipient' }, { status: 400 });
    const { subject, html } = buildEmail(template, { campaign_title, campaign_url, amount, donor_name, organizer_name, milestone, days_left });
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: html });
    return Response.json({ ok: true, sent: true });
  } catch (error) {
    console.error('sendCampaignEmail error', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
