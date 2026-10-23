/**
 * Dormant owner-link dispatch boundary. Does not import provider credentials or
 * expose an endpoint until the operator enables the independently tested route.
 */
export const OWNER_LINK_PATH = '/api/v1/migration/owner-link';

export async function dispatchOwnerLink(request, env, handler) {
  let pathname;
  try { pathname = new URL(request.url).pathname; }
  catch { return null; }
  if (pathname !== OWNER_LINK_PATH) return null;

  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };
  // Never call the owner-link handler or read credentials if disabled.
  if (env?.IFUND_OWNER_LINK_ENABLED !== 'enabled' || typeof handler !== 'function') {
    return new Response(JSON.stringify({ error: 'owner_link_unavailable', cutover_ready: false }), {
      status: 503, headers,
    });
  }
  try {
    return await handler(request, env);
  } catch {
    // Do not reflect provider, SQL, token, or runtime error messages.
    return new Response(JSON.stringify({ error: 'owner_link_unavailable', cutover_ready: false }), {
      status: 503, headers,
    });
  }
}
