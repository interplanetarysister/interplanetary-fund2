import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { redactCredentials } from '../../shared/integrationRegistry.ts';

const diagnosticType = (error) => {
  if (error instanceof TypeError) return 'type';
  if (error instanceof SyntaxError) return 'syntax';
  if (error instanceof RangeError) return 'range';
  if (error instanceof Error) return 'error';
  switch (typeof error) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'undefined': return 'undefined';
    case 'object': return error === null ? 'null' : 'object';
    default: return 'unknown';
  }
};

// Returns the caller's PlatformConnection records with secret credential
// values redacted (blanked) and a credentials_meta map indicating which secrets
// are set. RLS already scopes reads to the owner (or all, for admins); this
// layer ensures raw Bluesky/Mastodon/Ko-fi secrets never reach frontend state.
// Non-secret identifiers (handles, instances) are kept so the edit form works.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const list = await base44.entities.PlatformConnection.list('-updated_date', 300);
    if (!Array.isArray(list)) {
      return Response.json({ error: 'Could not load connections.' }, { status: 502 });
    }

    const connections = list.map((c) => {
      if (!c || typeof c !== 'object') return null;
      const { credentials, credentials_meta } = redactCredentials(c.credentials);
      return { ...c, credentials, credentials_meta };
    }).filter(Boolean);
    return Response.json({ connections });
  } catch (error) {
    console.error('listConnections failed', { diagnostic_type: diagnosticType(error) });
    return Response.json({ error: 'Could not load connections.' }, { status: 500 });
  }
}
