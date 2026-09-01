import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Permanently deletes the requesting user's account and all of their owned
// data across the platform. The user must confirm in the UI before this is
// called; the service role performs the deletes (admin-equivalent).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = base44.asServiceRole;

    // 0. Delete the account itself first — if the platform refuses (e.g. the
    //    app owner), bail before destroying any of the user's data.
    await admin.entities.User.delete(user.id);

    // 1. Personal data
    await admin.entities.FollowedCampaign.deleteMany({ user_id: user.id });
    await admin.entities.Notification.deleteMany({ user_id: user.id });
    await admin.entities.InboxItem.deleteMany({ user_id: user.id });
    await admin.entities.MissionBrief.deleteMany({ created_by_id: user.id });
    await admin.entities.Recommendation.deleteMany({ created_by_id: user.id });
    await admin.entities.Recommendation.deleteMany({ owner_user_id: user.id });
    await admin.entities.AgentActivity.deleteMany({ owner_user_id: user.id });
    await admin.entities.Message.deleteMany({ created_by_id: user.id });
    await admin.entities.CommunityMember.deleteMany({ user_id: user.id });
    await admin.entities.VolunteerSignup.deleteMany({ user_id: user.id });
    await admin.entities.DiscussionPost.deleteMany({ created_by_id: user.id });
    await admin.entities.DiscussionReply.deleteMany({ created_by_id: user.id });
    await admin.entities.GrantApplication.deleteMany({ applicant_user_id: user.id });
    await admin.entities.Withdrawal.deleteMany({ owner_user_id: user.id });

    // 2. Anonymize donations this user made to OTHER people's campaigns — the
    //    campaign owner still needs the ledger entry, but the donor's identity
    //    is removed for retention/privacy compliance. Cancel any active
    //    recurring gifts first, then strip the PII.
    await admin.entities.Donation.updateMany(
      { donor_user_id: user.id, recurring_status: 'active' },
      { $set: { recurring_status: 'cancelled' } }
    );
    await admin.entities.Donation.updateMany(
      { donor_user_id: user.id },
      { $set: { donor_user_id: '', donor_name: 'Deleted user', message: '' } }
    );

    // 3. Owned campaigns and everything attached to them
    const campaigns = await admin.entities.Campaign.filter({ created_by_id: user.id });
    for (const c of campaigns) {
      await admin.entities.CampaignUpdate.deleteMany({ campaign_id: c.id });
      await admin.entities.Donation.deleteMany({ campaign_id: c.id });
      await admin.entities.DistributedPost.deleteMany({ campaign_id: c.id });
      await admin.entities.AgentActivity.deleteMany({ campaign_id: c.id });
    }
    await admin.entities.Campaign.deleteMany({ created_by_id: user.id });

    // 4. Connections
    await admin.entities.PlatformConnection.deleteMany({ created_by_id: user.id });

    return Response.json({ deleted: true });
  } catch (error) {
    console.error('deleteAccount error:', error.message);
    return Response.json({ error: 'Unable to delete your account. Please try again or contact support.' }, { status: 500 });
  }
}