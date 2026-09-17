import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Sends a welcome email + in-app notification to a new volunteer. Runs from
// the "Volunteer Welcome Follow-up" workflow (service-scoped, no user context).
// sendCommunication is user-context-bound (messages a campaign's donors), so
// this delivers the welcome directly via the service role.

function classifyThrownValue(value: unknown): string {
  try {
    if (value === null) return 'null';
    switch (typeof value) {
      case 'undefined': return 'undefined';
      case 'string': return 'string';
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'bigint': return 'bigint';
      case 'symbol': return 'symbol';
      case 'function': return 'function';
      default: return 'object';
    }
  } catch {
    return 'unknown';
  }
}

function logSafeFailure(scope: string, value: unknown): void {
  console.error(`${scope} failed`, { kind: classifyThrownValue(value) });
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const { signup_id } = await req.json();
    if (!signup_id) return Response.json({ error: 'Missing signup_id' }, { status: 400 });

    const signup = await sr.entities.VolunteerSignup.get(signup_id).catch(() => null);
    if (!signup) return Response.json({ error: 'Signup not found' }, { status: 404 });

    const [opp, community, user] = await Promise.all([
      sr.entities.VolunteerOpportunity.get(signup.opportunity_id).catch(() => null),
      signup.community_id ? sr.entities.Community.get(signup.community_id).catch(() => null) : null,
      signup.user_id ? sr.entities.User.get(signup.user_id).catch(() => null) : null,
    ]);

    const roleTitle = opp?.role_title || 'volunteer opportunity';
    const communityName = community?.name || 'the community';

    if (user?.email && (user.comm_prefs || {}).email_updates !== false) {
      try {
        await sr.integrations.Core.SendEmail({
          to: user.email,
          subject: `Welcome to ${communityName} — you're signed up for ${roleTitle}`,
          body: `Hi ${user.full_name || 'there'},\n\nThank you for volunteering for "${roleTitle}" in ${communityName}. We'll be in touch with next steps.\n\nIn the meantime, complete your profile so organizers can match you to more opportunities.\n\n— Interplanetary Fund`,
          from_name: 'Interplanetary Fund',
        });
      } catch (error) {
        logSafeFailure('welcome email', error);
      }
    }

    await sr.entities.Notification.create({
      user_id: signup.user_id,
      title: `Welcome — you're volunteering for ${roleTitle}`,
      body: `Thanks for signing up to help ${communityName}. Complete your profile to get matched to more opportunities.`,
      type: 'system',
      link: signup.community_id ? `/community/${signup.community_id}` : '/profile',
    });

    return Response.json({ ok: true });
  } catch (error) {
    logSafeFailure('welcomeVolunteer', error);
    return Response.json({ error: 'Unable to send the welcome. Please try again.' }, { status: 500 });
  }
}