import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { redactCredentials } from '../../shared/integrationRegistry.ts';

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
    const connections = list.map((c) => {
      const { credentials, credentials_meta } = redactCredentials(c.credentials);
      return { ...c, credentials, credentials_meta };
    });
    return Response.json({ connections });
  } catch (error) {
    console.error('listConnections error:', error.message);
    return Response.json({ error: 'Could not load connections.' }, { status: 500 });
  }
}