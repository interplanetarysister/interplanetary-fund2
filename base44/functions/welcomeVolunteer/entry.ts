import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SAFE_WELCOME_ERROR = 'Unable to send the welcome. Please try again.';
const MAX_ID_LENGTH = 120;

function diagnosticType(error: unknown): string {
  if (error instanceof Error) return 'error';
  if (typeof error === 'string') return 'string';
  if (error === null) return 'null';
  return typeof error;
}

function isValidSignupId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= MAX_ID_LENGTH && !/[\u0000-\u001f\u007f]/.test(normalized);
}

// Sends a welcome email + in-app notification to a new volunteer. Runs from
// the "Volunteer Welcome Follow-up" workflow (service-scoped, no user context).
// sendCommunication is user-context-bound (messages a campaign's donors), so
// this delivers the welcome directly via the service role.
export default async function(req) {
  if (req?.method && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', allow: 'POST' },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
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
    if (keys.some((key) => key !== 'signup_id')) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const signupId = typeof body.signup_id === 'string' ? body.signup_id.trim() : body.signup_id;
    if (!isValidSignupId(signupId)) {
      return Response.json({ error: 'Missing signup_id' }, { status: 400 });
    }

    const signup = await sr.entities.VolunteerSignup.get(signupId).catch(() => null);
    if (!signup) return Response.json({ error: 'Signup not found' }, { status: 404 });

    const [opp, community, user] = await Promise.all([
      sr.entities.VolunteerOpportunity.get(signup.opportunity_id).catch(() => null),
      signup.community_id ? sr.entities.Community.get(signup.community_id).catch(() => null) : null,
      signup.user_id ? sr.entities.User.get(signup.user_id).catch(() => null) : null,
    ]);

    const roleTitle = typeof opp?.role_title === 'string' && opp.role_title.trim() ? opp.role_title.trim() : 'volunteer opportunity';
    const communityName = typeof community?.name === 'string' && community.name.trim() ? community.name.trim() : 'the community';

    if (user?.email && (user.comm_prefs || {}).email_updates !== false) {
      try {
        await sr.integrations.Core.SendEmail({
          to: user.email,
          subject: `Welcome to ${communityName} — you're signed up for ${roleTitle}`,
          body: `Hi ${user.full_name || 'there'},\n\nThank you for volunteering for "${roleTitle}" in ${communityName}. We'll be in touch with next steps.\n\nIn the meantime, complete your profile so organizers can match you to more opportunities.\n\n— Interplanetary Fund`,
          from_name: 'Interplanetary Fund',
        });
      } catch (error) {
        console.error('welcome email failed:', diagnosticType(error));
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
    console.error('welcomeVolunteer error:', diagnosticType(error));
    return Response.json({ error: SAFE_WELCOME_ERROR }, { status: 500 });
  }
}
