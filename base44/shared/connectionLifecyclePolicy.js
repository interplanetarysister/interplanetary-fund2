import { hasFreshProviderVerification } from './providerVerificationPolicy.js';

export function deriveConnectionLifecycle({
  connection,
  shared,
  oauth,
  recipe,
  browserRunEnabled = false,
  now = Date.now(),
}) {
  if (recipe?.shared) {
    if (!shared?.connected) return 'NOT_CONNECTED';
    if (!shared?.verified) return shared?.last_error ? 'DEGRADED' : 'RECONNECT_REQUIRED';
    return 'CONNECTED';
  }

  const transport = recipe?.preferred_transport;
  if (!connection) {
    if (transport === 'oauth' && oauth?.configured && !oauth?.transport_ok) return 'AUTHORIZATION_REQUIRED';
    return 'NOT_CONNECTED';
  }

  if (transport === 'public_browser') {
    if (!connection.external_url || connection.obo_consent?.granted !== true) return 'AUTHORIZATION_REQUIRED';
    if (!browserRunEnabled) return 'BLOCKED';
    return hasFreshProviderVerification(connection, now) ? 'CONNECTED' : 'CONNECTING';
  }

  if (connection.status === 'disconnected') return 'DISCONNECTED';
  if (connection.status === 'error') return oauth?.transport_ok ? 'DEGRADED' : 'RECONNECT_REQUIRED';

  const fresh = hasFreshProviderVerification(connection, now);
  if (transport === 'oauth') {
    if (!oauth?.transport_ok) return 'RECONNECT_REQUIRED';
    return fresh ? 'CONNECTED' : 'CONNECTING';
  }
  if (transport === 'token') return fresh ? 'CONNECTED' : 'AUTHORIZATION_REQUIRED';
  if (transport === 'webhook') {
    return fresh && connection.external_data_source === 'provider_verified' ? 'CONNECTED' : 'CONNECTING';
  }
  return fresh ? 'CONNECTED' : 'CONNECTING';
}

export function scopedOboGrants(connection, grants, now = Date.now()) {
  if (connection?.obo_consent?.granted !== true || connection?.agent_access?.shared_with_agents !== true) return [];
  const allowed = new Set(connection.obo_consent?.granted_capabilities || []);
  if (!allowed.size) return [];
  return (Array.isArray(grants) ? grants : []).filter((grant) => {
    if (grant?.status !== 'active' || !grant?.agent_name || !allowed.has(grant?.scope)) return false;
    if (!grant.expires_at) return true;
    const expires = Date.parse(grant.expires_at);
    return Number.isFinite(expires) && expires > now;
  });
}
