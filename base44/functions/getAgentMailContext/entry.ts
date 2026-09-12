import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';

const MAX_ID = 128;
const MAX_AGENT = 96;
const MAX_ITEMS = 20;
const MAX_CONTENT = 1200;
const MAX_PREVIEW = 160;
const MAX_DRAFT = 800;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_AGENT = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,95}$/;
const SAFE_STATUS = new Set(['unread', 'read', 'archived', 'pending', 'resolved', 'open', 'closed']);
const SAFE_TYPES = new Set(['message', 'notification', 'inquiry', 'comment', 'system', 'email']);
const SAFE_PLATFORMS = new Set(['email', 'system', 'facebook', 'instagram', 'x', 'bluesky', 'other']);

function safeString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

function safeOptionalString(value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  return safeString(value, max);
}

function safeId(value: unknown, pattern: RegExp = SAFE_ID): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length <= MAX_ID && pattern.test(normalized) ? normalized : null;
}

function diagnosticType(error: unknown): string {
  try {
    const tag = Object.prototype.toString.call(error);
    if (tag === '[object Error]') {
      const name = typeof (error as { name?: unknown })?.name === 'string' ? (error as { name: string }).name : 'Error';
      return name.slice(0, 32).replace(/[^A-Za-z0-9_.-]/g, '_') || 'Error';
    }
    return tag.slice(8, -1).slice(0, 32).replace(/[^A-Za-z0-9_.-]/g, '_') || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function projectItem(item: unknown, userId: string, includeContent: boolean) {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const id = safeId(row.id);
  const ownerId = safeId(row.user_id);
  if (!id || !ownerId || ownerId !== userId) return null;
  const platform = safeOptionalString(row.platform, 32);
  const type = safeOptionalString(row.type, 32);
  const author = safeOptionalString(row.author, 160);
  const status = safeOptionalString(row.status, 32);
  const createdDate = safeOptionalString(row.created_date, 64);
  if (platform && !SAFE_PLATFORMS.has(platform)) return null;
  if (type && !SAFE_TYPES.has(type)) return null;
  if (status && !SAFE_STATUS.has(status)) return null;
  if (createdDate && !/^\d{4}-\d{2}-\d{2}T[^\s]{1,48}Z$/.test(createdDate)) return null;
  const result: Record<string, unknown> = { id, platform, type, author, status };
  if (includeContent) {
    result.content = safeOptionalString(row.content, MAX_CONTENT);
    result.link = safeOptionalString(row.link, 512);
    result.ai_draft = safeOptionalString(row.ai_draft, MAX_DRAFT);
  } else {
    result.preview = safeOptionalString(row.content, MAX_PREVIEW);
    result.created_date = createdDate;
  }
  return result;
}

export default async function (req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'POST' } });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Request body must be an object.' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const allowedKeys = new Set(['agent_name', 'user_id', 'item_id']);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    return Response.json({ error: 'Unexpected request field.' }, { status: 400 });
  }
  const agentName = safeId(input.agent_name, SAFE_AGENT);
  const userId = safeId(input.user_id);
  const itemId = input.item_id === undefined ? null : safeId(input.item_id);
  if (!agentName || !userId || (input.item_id !== undefined && !itemId)) {
    return Response.json({ error: 'Valid agent_name and user_id are required.' }, { status: 400 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    let entries: unknown;
    try {
      entries = await sr.entities.PlatformAccessRegistry.filter({ platform: 'email' });
    } catch (error) {
      console.error('getAgentMailContext registry failure:', diagnosticType(error));
      return Response.json({ error: 'Could not verify agent authorization.' }, { status: 503 });
    }
    if (!Array.isArray(entries) || entries.length > 20) {
      console.error('getAgentMailContext invalid registry response');
      return Response.json({ error: 'Could not verify agent authorization.' }, { status: 503 });
    }
    const entry = entries.find((candidate) => {
      if (!candidate || typeof candidate !== 'object') return false;
      const row = candidate as Record<string, unknown>;
      return row.status === 'ACTIVE' && Array.isArray(row.authorized_agents) && row.authorized_agents.every((value) => typeof value === 'string') && row.authorized_agents.includes(agentName);
    });
    const authorized = !!entry;

    await logAudit(base44, {
      action: 'agent_mail_context',
      actor_user_id: userId,
      target_type: 'InboxItem',
      target_id: itemId || '',
      detail: `agent=${agentName.slice(0, MAX_AGENT)} user=${userId.slice(0, MAX_ID)} item=${itemId || 'none'} authorized=${authorized}`,
      status: authorized ? 'success' : 'failure',
      metadata: { agent_name: agentName.slice(0, MAX_AGENT), user_id: userId, item_id: itemId },
    });

    if (!authorized) return Response.json({ authorized: false, error: 'Agent is not authorized to read internal mail context.' }, { status: 403 });

    if (itemId) {
      let item: unknown;
      try {
        item = await sr.entities.InboxItem.get(itemId);
      } catch (error) {
        console.error('getAgentMailContext item lookup failure:', diagnosticType(error));
        return Response.json({ error: 'Could not retrieve mail context.' }, { status: 503 });
      }
      const projected = projectItem(item, userId, true);
      if (!projected) return Response.json({ error: 'Item not found for this user.' }, { status: 404 });
      return Response.json({ authorized: true, item: projected });
    }

    let items: unknown;
    try {
      items = await sr.entities.InboxItem.filter({ user_id: userId }, '-created_date', MAX_ITEMS);
    } catch (error) {
      console.error('getAgentMailContext inbox lookup failure:', diagnosticType(error));
      return Response.json({ error: 'Could not retrieve mail context.' }, { status: 503 });
    }
    if (!Array.isArray(items) || items.length > MAX_ITEMS) return Response.json({ error: 'Could not retrieve mail context.' }, { status: 502 });
    const projectedItems = items.map((item) => projectItem(item, userId, false));
    if (projectedItems.some((item) => !item)) return Response.json({ error: 'Could not retrieve mail context.' }, { status: 502 });
    return Response.json({ authorized: true, items: projectedItems });
  } catch (error) {
    console.error('getAgentMailContext error:', diagnosticType(error));
    return Response.json({ error: 'Could not retrieve mail context.' }, { status: 500 });
  }
}
