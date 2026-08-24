import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { campaign_id, subject, content, comm_type, audience, channels, ai_generated } = await req.json();
    if (!subject || !content || !Array.isArray(channels) || channels.length === 0) {
      return Response.json({ error: 'Subject, content and at least one channel are required' }, { status: 400 });
    }
    const allowedChannels = ['email', 'in_app'];
    if (channels.some((channel) => !allowedChannels.includes(channel))) {
      return Response.json({ error: 'Unsupported communication channel.' }, { status: 400 });
    }

    // Only allow messaging donors of campaigns the sender owns.
    const myCampaigns = await base44.entities.Campaign.filter({ created_by_id: user.id });
    const myIds = myCampaigns.map((c) => c.id);
    if (campaign_id && !myIds.includes(campaign_id)) {
      return Response.json({ error: 'You can only message donors of your own campaigns' }, { status: 403 });
    }
    const campaignIds = campaign_id ? [campaign_id] : myIds;
    if (campaignIds.length === 0) {
      return Response.json({ error: 'You have no campaigns yet' }, { status: 400 });
    }

    // Resolve audience.
    const donations = await base44.asServiceRole.entities.Donation.filter({ campaign_id: { $in: campaignIds } });
    let pool = donations;
    if (audience === 'recurring_donors') {
      pool = donations.filter((d) => d.is_recurring && (d.recurring_status || 'active') === 'active');
    }
    const donorIds = [...new Set(pool.map((d) => d.donor_user_id).filter(Boolean))].filter((id) => id !== user.id);
    const recipients = donorIds.length
      ? await base44.asServiceRole.entities.User.filter({ id: { $in: donorIds } })
      : [];

    // Track delivery separately by channel so the audit record cannot claim
    // full success when one channel or some recipients failed.
    let emailCount = 0;
    let emailFailureCount = 0;
    const notifications = [];
    const deliveryErrors = [];

    for (const r of recipients) {
      const prefs = r.comm_prefs || {};
      if (channels.includes('email') && prefs.email_updates !== false && r.email) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: r.email,
            subject,
            body: content,
            from_name: user.full_name || 'Interplanetary Fund',
          });
          emailCount++;
        } catch (e) {
          emailFailureCount++;
          deliveryErrors.push(`email:${r.id}:${e.message}`);
          console.error('Email delivery failed for recipient:', e.message);
        }
      }
      if (channels.includes('in_app') && prefs.in_app_updates !== false) {
        notifications.push({
          user_id: r.id,
          title: subject,
          body: content.slice(0, 300),
          type: comm_type || 'update',
          link: campaign_id ? `/campaign/${campaign_id}` : '/discover',
        });
      }
    }

    let inAppCount = 0;
    let notificationPersistenceFailed = false;
    if (notifications.length > 0) {
      try {
        await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
        inAppCount = notifications.length;
      } catch (e) {
        notificationPersistenceFailed = true;
        deliveryErrors.push(`in_app:${e.message}`);
        console.error('In-app notification persistence failed:', e.message);
      }
    }

    const emailRequested = channels.includes('email');
    const inAppRequested = channels.includes('in_app');
    const emailAttempted = emailCount + emailFailureCount;
    const emailSucceeded = !emailRequested || (emailAttempted > 0 && emailFailureCount === 0);
    const inAppSucceeded = !inAppRequested || (!notificationPersistenceFailed && (recipients.length === 0 || notifications.length === inAppCount));
    const anyDeliverySucceeded = emailCount > 0 || inAppCount > 0;
    const allRequestedSucceeded = emailSucceeded && inAppSucceeded;
    const status = allRequestedSucceeded ? 'sent' : anyDeliverySucceeded ? 'partial' : 'failed';
    const deliveryError = deliveryErrors.length > 0 ? deliveryErrors.slice(0, 20).join('; ') : '';

    const campaign = campaign_id ? myCampaigns.find((c) => c.id === campaign_id) : null;
    let message;
    try {
      message = await base44.entities.Message.create({
        campaign_id: campaign_id || '',
        campaign_title: campaign ? campaign.title : 'All my campaigns',
        subject,
        content,
        comm_type: comm_type || 'update',
        audience: audience || 'campaign_donors',
        channels,
        status,
        sent_at: new Date().toISOString(),
        recipient_count: recipients.length,
        email_count: emailCount,
        in_app_count: inAppCount,
        email_failure_count: emailFailureCount,
        delivery_error: deliveryError,
        ai_generated: !!ai_generated,
      });
    } catch (messageError) {
      // Delivery has already occurred, so do not falsely report a clean success
      // when the audit record itself could not be persisted.
      console.error('Communication audit record failed:', messageError.message);
      return Response.json({
        ok: false,
        status: 'failed',
        audit_persisted: false,
        recipients: recipients.length,
        emails: emailCount,
        in_app: inAppCount,
        email_failures: emailFailureCount,
        delivery_error: deliveryError,
        error: 'Delivery completed but the communication audit record could not be persisted.',
      }, { status: 500 });
    }

    return Response.json({
      ok: status === 'sent',
      status,
      recipients: recipients.length,
      emails: emailCount,
      in_app: inAppCount,
      email_failures: emailFailureCount,
      delivery_error: deliveryError || undefined,
      message_id: message.id,
    }, { status: status === 'sent' ? 200 : 207 });
  } catch (error) {
    console.error('sendCommunication error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}