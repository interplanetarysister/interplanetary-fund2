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

const PUBLIC_CONNECTION_FIELDS = [
  'id', 'platform', 'status', 'display_name', 'handle', 'username', 'instance',
  'auth_type', 'environment', 'created_date', 'updated_date', 'last_synced_at',
];

function projectConnection(connection) {
  if (!connection || typeof connection !== 'object' || Array.isArray(connection)) return null;
  const projected = {};
  for (const field of PUBLIC_CONNECTION_FIELDS) {
    const value = connection[field];
    if (value === undefined) continue;
    if (typeof value === 'string' && value.length > 512) continue;
    if (typeof value !== 'string') continue;
    projected[field] = value;
  }
  const { credentials, credentials_meta } = redactCredentials(connection.credentials);
  projected.credentials = credentials;
  projected.credentials_meta = credentials_meta;
  return projected;
}

// Returns the caller's PlatformConnection records with secret credential
// values redacted and a strict response projection. Non-secret identifiers are
// kept so the edit form works; unknown/private entity fields are not returned.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const list = await base44.entities.PlatformConnection.list('-updated_date', 300);
    if (!Array.isArray(list)) {
      return Response.json({ error: 'Could not load connections.' }, { status: 502 });
    }

    const connections = [];
    for (const connection of list) {
      const projected = projectConnection(connection);
      if (!projected) {
        return Response.json({ error: 'Could not load connections.' }, { status: 502 });
      }
      connections.push(projected);
    }

    return Response.json({ connections });
  } catch (error) {
    console.error('listConnections failed', { diagnostic_type: diagnosticType(error) });
    return Response.json({ error: 'Could not load connections.' }, { status: 500 });
  }
}
