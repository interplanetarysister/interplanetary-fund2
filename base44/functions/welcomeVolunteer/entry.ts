import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SAFE_ERROR = 'Unable to send the welcome. Please try again.';
const MAX_SIGNUP_ID_LENGTH = 160;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function isValidSignupId(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_SIGNUP_ID_LENGTH
    && !CONTROL_CHARS.test(value);
}

function classifyError(error) {
  if (error && typeof error === 'object') {
    const status = error.status ?? error.statusCode;
    if (status === 401 || status === 403) return 'auth';
    if (status === 404) return 'not_found';
    if (status === 408 || status === 429) return 'retryable';
  }
  return 'internal';
}

function isNotFoundError(error) {
  return Boolean(error && typeof error === 'object'
    && (error.status === 404 || error.statusCode === 404));
}

function safeLog(event, error) {
  console.error(`welcomeVolunteer:${event}:${classifyError(error)}`);
}

// Sends a welcome email + in-app notification to a new volunteer. Runs from
// the "Volunteer Welcome Follow-up" workflow (service-scoped, no user context).
// sendCommunication is user-context-bound (messages a campaign's donors), so
// this delivers the welcome directly via the service role.
export default async function(req) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    safeLog('invalid_json', error);
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!body || Array.isArray(body) || typeof body !== 'object' || !isValidSignupId(body.signup_id)) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    let signup;
    try {
      signup = await sr.entities.VolunteerSignup.get(body.signup_id);
    } catch (error) {
      safeLog('signup_lookup', error);
      if (isNotFoundError(error)) {
        return Response.json({ error: 'Signup not found' }, { status: 404 });
      }
      return Response.json({ error: SAFE_ERROR }, { status: 503, headers: { 'Retry-After': '30' } });
    }
    if (!signup) return Response.json({ error: 'Signup not found' }, { status: 404 });

    const [opp, community, user] = await Promise.all([
      sr.entities.VolunteerOpportunity.get(signup.opportunity_id).catch((error) => {
        safeLog('opportunity_lookup', error);
        return null;
      }),
      signup.community_id ? sr.entities.Community.get(signup.community_id).catch((error) => {
        safeLog('community_lookup', error);
        return null;
      }) : null,
      signup.user_id ? sr.entities.User.get(signup.user_id).catch((error) => {
        safeLog('user_lookup', error);
        return null;
      }) : null,
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
        safeLog('welcome_email', error);
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
    safeLog('handler', error);
    return Response.json({ error: SAFE_ERROR }, { status: 500 });
  }
}
