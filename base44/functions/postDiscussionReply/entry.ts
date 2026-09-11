import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SAFE_ERROR = 'Unable to post your reply. Please try again.';
const MAX_ID_LENGTH = 128;
const MAX_CONTENT_LENGTH = 5000;
const MAX_AUTHOR_LENGTH = 160;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasControlChars(value) {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function isValidId(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= MAX_ID_LENGTH && !hasControlChars(value);
}

function boundedText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function diagnosticType(error) {
  if (error instanceof Error) return error.name || 'Error';
  if (error === null) return 'null';
  return typeof error;
}

export default async function(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to reply.' }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    if (!isRecord(body)) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

    const allowedKeys = new Set(['post_id', 'community_id', 'content']);
    if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const postId = typeof body.post_id === 'string' ? body.post_id.trim() : '';
    const communityId = body.community_id == null ? null : typeof body.community_id === 'string' ? body.community_id.trim() : '';
    const content = boundedText(body.content, MAX_CONTENT_LENGTH);
    if (!isValidId(postId) || (body.community_id != null && !isValidId(communityId)) || !content) {
      return Response.json({ error: 'Missing or invalid reply details.' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const post = await sr.entities.DiscussionPost.get(postId).catch(() => null);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

    const serverCommunityId = typeof post.community_id === 'string' ? post.community_id.trim() : '';
    if (!isValidId(serverCommunityId) || (communityId && communityId !== serverCommunityId)) {
      return Response.json({ error: 'Invalid reply target.' }, { status: 400 });
    }

    const authorName = boundedText(user.full_name || user.email || 'User', MAX_AUTHOR_LENGTH) || 'User';
    const reply = await base44.entities.DiscussionReply.create({
      post_id: postId,
      community_id: serverCommunityId,
      content,
      author_name: authorName,
    });
    await sr.entities.DiscussionPost.updateMany(
      { id: postId },
      { $inc: { reply_count: 1 } }
    );
    return Response.json({ reply });
  } catch (error) {
    console.error('postDiscussionReply error:', diagnosticType(error));
    return Response.json({ error: SAFE_ERROR }, { status: 500 });
  }
}
