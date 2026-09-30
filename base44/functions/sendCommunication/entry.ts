import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ALLOWED_CHANNELS = new Set(['email', 'in_app']);
const ALLOWED_COMM_TYPES = new Set(['update', 'thank_you', 'announcement', 'milestone', 'volunteer', 'sponsor']);
const ALLOWED_AUDIENCES = new Set(['campaign_donors', 'all_donors', 'recurring_donors']);
const MAX_SUBJECT_LENGTH = 200;
const MAX_CONTENT_LENGTH = 20_000;
const MAX_CHANNELS = 2;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { campaign_id, subject, content, comm_type, audience, channels, ai_generated } = await req.json();
    const normalizedChannels = Array.isArray(channels) ? [...new Set(channels)] : [];
    const validCampaignId = campaign_id === undefined || typeof campaign_id === 'string';
    const validSubject = typeof subject === 'string' && subject.trim().length > 0 && subject.length <= MAX_SUBJECT_LENGTH;
    const validContent = typeof content === 'string' && content.trim().length > 0 && content.length <= MAX_CONTENT_LENGTH;
    const validChannels = normalizedChannels.length > 0 && normalizedChannels.length <= MAX_CHANNELS && normalizedChannels.every((channel) => typeof channel === 'string' && ALLOWED_CHANNELS.has(channel));
    if (!validCampaignId || !validSubject || !validContent || !validChannels || (comm_type !== undefined && !ALLOWED_COMM_TYPES.has(comm_type)) || (audience !== undefined && !ALLOWED_AUDIENCES.has(audience)) || (ai_generated !== undefined && typeof ai_generated !== 'boolean')) {
      return Response.json({ error: 'Invalid communication request.' }, { status: 400 });
    }

    const myCampaigns = await base44.entities.Campaign.filter({ created_by_id: user.id });
    const myIds = myCampaigns.map((c) => c.id);
    if (campaign_id && !myIds.includes(campaign_id)) return Response.json({ error: 'You can only message donors of your own campaigns' }, { status: 403 });
    const campaignIds = campaign_id ? [campaign_id] : myIds;
    if (campaignIds.length === 0) return Response.json({ error: 'You have no campaigns yet' }, { status: 400 });

    const donations = await base44.asServiceRole.entities.Donation.filter({ campaign_id: { $in: campaignIds } });
    let pool = donations;
    if (audience === 'recurring_donors') pool = donations.filter((d) => d.is_recurring && (d.recurring_status || 'active') === 'active');
    const donorIds = [...new Set(pool.map((d) => d.donor_user_id).filter(Boolean))].filter((id) => id !== user.id);
    const recipients = donorIds.length ? await base44.asServiceRole.entities.User.filter({ id: { $in: donorIds } }) : [];

    let emailCount = 0;
    const notifications = [];
    for (const r of recipients) {
      const prefs = r.comm_prefs || {};
      if (normalizedChannels.includes('email') && prefs.email_updates !== false && r.email) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({ to: r.email, subject, body: content, from_name: user.full_name || 'Interplanetary Fund' });
          emailCount++;
        } catch (e) {
          console.error('Email delivery failed for recipient:', e instanceof Error ? e.message : 'unknown');
        }
      }
      if (normalizedChannels.includes('in_app') && prefs.in_app_updates !== false) notifications.push({ user_id: r.id, title: subject, body: content.slice(0, 300), type: comm_type || 'update', link: campaign_id ? `/campaign/${campaign_id}` : '/discover' });
    }
    if (notifications.length > 0) await base44.asServiceRole.entities.Notification.bulkCreate(notifications);

    const campaign = campaign_id ? myCampaigns.find((c) => c.id === campaign_id) : null;
    const message = await base44.asServiceRole.entities.Message.create({
      created_by_id: user.id,
      campaign_id: campaign_id || '',
      campaign_title: campaign ? campaign.title : 'All my campaigns',
      subject,
      content,
      comm_type: comm_type || 'update',
      audience: audience || 'campaign_donors',
      channels: normalizedChannels,
      status: 'sent',
      sent_at: new Date().toISOString(),
      recipient_count: recipients.length,
      email_count: emailCount,
      in_app_count: notifications.length,
      ai_generated: ai_generated === true,
    });

    return Response.json({ ok: true, recipients: recipients.length, emails: emailCount, in_app: notifications.length, message_id: message.id });
  } catch (error) {
    console.error('sendCommunication error:', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'Unable to send communication.' }, { status: 500 });
  }
}
