import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MAX_ID = 200;
const MAX_TEXT = 240;
const MAX_EMAIL = 320;

function jsonError(error, status) {
  return Response.json({ error }, { status });
}

function diagnosticType(value) {
  const tag = Object.prototype.toString.call(value);
  if (tag === '[object Error]') return 'error';
  if (tag === '[object String]') return 'string';
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return tag.slice(8, -1).toLowerCase() || 'unknown';
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value, fallback, max = MAX_TEXT) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/[\\u0000-\\u001F\\u007F]/g, ' ').replace(/\\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, max) : fallback;
}

function normalizeId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_ID || /[\\u0000-\\u001F\\u007F]/.test(normalized)) return null;
  return normalized;
}

function safeEmail(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_EMAIL || /[\\r\\n\\u0000-\\u001F\\u007F]/.test(normalized)) return null;
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalized)) return null;
  return normalized;
}

function isNotFoundError(error) {
  const status = Number(error?.status ?? error?.response?.status);
  const code = typeof error?.code === 'string' ? error.code.toUpperCase() : '';
  return status === 404 || code === 'NOT_FOUND';
}

async function getEntity(loader, label) {
  try {
    return await loader();
  } catch (error) {
    if (isNotFoundError(error)) return null;
    console.error(`${label} failed`, { diagnostic_type: diagnosticType(error) });
    throw error;
  }
}

export default async function(req) {
  if (req?.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers: { 'content-type': 'application/json', allow: 'POST' } });

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid request body.', 400);
  }
  if (!isObject(body) || Object.keys(body).some((key) => key !== 'signup_id')) return jsonError('Invalid request body.', 400);

  const signup_id = normalizeId(body.signup_id);
  if (!signup_id) return jsonError('Invalid signup_id.', 400);

  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const signup = await getEntity(() => sr.entities.VolunteerSignup.get(signup_id), 'volunteer signup lookup');
    if (!signup) return Response.json({ skipped: true, reason: 'signup removed' });

    const user = signup.user_id ? await getEntity(() => sr.entities.User.get(signup.user_id), 'volunteer user lookup') : null;
    if (!user) return Response.json({ skipped: true, reason: 'user removed' });
    if (user.onboarding_completed) return Response.json({ skipped: true, reason: 'profile complete' });

    const opp = signup.opportunity_id ? await getEntity(() => sr.entities.VolunteerOpportunity.get(signup.opportunity_id), 'volunteer opportunity lookup') : null;
    const community = signup.community_id ? await getEntity(() => sr.entities.Community.get(signup.community_id), 'volunteer community lookup') : null;

    const roleTitle = boundedText(opp?.role_title, 'your volunteer role');
    const communityName = boundedText(community?.name, 'us');
    const fullName = boundedText(user.full_name, 'there');
    const email = safeEmail(user.email);

    if (email && isObject(user.comm_prefs) && user.comm_prefs.email_updates !== false) {
      try {
        await sr.integrations.Core.SendEmail({
          to: email,
          subject: `Ready for your next step with ${communityName}?`,
          body: `Hi ${fullName},\\n\\nYou signed up for "${roleTitle}" a few days ago. Complete your profile so we can match you to more opportunities and tasks tailored to you.\\n\\nFinish setup: open your Interplanetary Fund profile.\\n\\n— Interplanetary Fund`,
          from_name: 'Interplanetary Fund',
        });
      } catch (error) {
        console.error('follow-up email failed', { diagnostic_type: diagnosticType(error) });
      }
    }

    await sr.entities.Notification.create({
      user_id: signup.user_id,
      title: 'Complete your profile to unlock more tasks',
      body: `You're signed up for ${roleTitle}. Finish your profile so we can match you to more opportunities.`,
      type: 'system',
      link: '/profile',
    });

    return Response.json({ ok: true, followed_up: true });
  } catch (error) {
    console.error('volunteerFollowUp failed', { diagnostic_type: diagnosticType(error) });
    return jsonError('Unable to send the follow-up. Please try again.', 500);
  }
}
