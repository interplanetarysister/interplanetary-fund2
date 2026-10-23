/**
 * Dormant same-origin owner-consent endpoint for IFund migration.
 * Must be deployed ONLY with a Cloudflare durable Rate Limiting binding,
 * a 32+ character server-only CSRF secret, and server-only Supabase keys.
 * Never attach to public routing without integration and positive auth tests.
 */
import { linkVerifiedOwnerSessions } from './owner-link-gate.mjs';
import { makeOwnerProofAdapters } from './owner-proof-adapters.mjs';
import { ownerConsentOriginAllowed } from './owner-consent-origin.mjs';

const ROUTE = '/api/v1/migration/owner-link';
const encoder = new TextEncoder();
const text = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer', 'vary': 'Origin', ...extra,
  },
});
const deny = (status = 403) => text({ ok: false, error: 'not_authorized' }, status);
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (str) => {
  if (!/^[A-Za-z0-9_-]+$/.test(str)) throw Error('invalid');
  return Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
};
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signChallenge(key, origin, now) {
  const payload = b64url(encoder.encode(JSON.stringify({ origin, expires: now + 300_000, nonce: crypto.randomUUID() })));
  const signature = b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
  return `${payload}.${signature}`;
}
async function validChallenge(key, token, origin, now) {
  if (typeof token !== 'string' || token.length > 1024) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const signature = fromB64url(parts[1]);
    if (!(await crypto.subtle.verify('HMAC', key, signature, encoder.encode(parts[0])))) return false;
    const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fromB64url(parts[0])));
    return payload.origin === origin && typeof payload.nonce === 'string' &&
      /^[0-9a-f-]{36}$/i.test(payload.nonce) && Number.isSafeInteger(payload.expires) &&
      payload.expires > now && payload.expires <= now + 300_000;
  } catch { return false; }
}
async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))),
    b => b.toString(16).padStart(2, '0')).join('');
}
async function boundedBody(request) {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > 256)) throw Error('size');
  if (!request.body?.getReader) throw Error('body');
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256) throw Error('size');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let pos = 0;
  for (const chunk of chunks) { bytes.set(chunk, pos); pos += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
const tokenOK = v => typeof v === 'string' && v.length >= 16 && v.length <= 8192 && !/\s/.test(v);

/** A pure request handler. Never imports browser secrets or trusts client identity fields. */
export async function handleOwnerConsent(request, env, { fetcher = globalThis.fetch, now = () => Date.now() } = {}) {
  let url;
  try { url = new URL(request.url); } catch { return deny(); }
  if (url.pathname !== ROUTE || url.search || !ownerConsentOriginAllowed(request, url)) return deny();
  if (!['GET', 'POST'].includes(request.method)) return text({ error: 'method_not_allowed' }, 405, { allow: 'GET, POST' });
  const secret = env?.IFUND_OWNER_LINK_CSRF_SECRET;
  const limiter = env?.IFUND_OWNER_LINK_LIMITER;
  const ip = request.headers.get('cf-connecting-ip');
  if (typeof secret !== 'string' || secret.length < 32 ||
      !limiter || typeof limiter.limit !== 'function' ||
      typeof ip !== 'string' || !/^[0-9a-f:.]{3,45}$/i.test(ip)) {
    return text({ error: 'not_configured' }, 503);
  }
  // Durable provider rate-limit binding; fail closed on errors or exhaustion.
  try {
    const key = (request.method === 'GET' ? 'challenge:' : 'commit:') + await hash(ip);
    if ((await limiter.limit({ key }))?.success !== true) return text({ error: 'rate_limited' }, 429);
  } catch { return text({ error: 'rate_limiter_unavailable' }, 503); }
  let key;
  try { key = await hmacKey(secret); } catch { return text({ error: 'not_configured' }, 503); }
  if (request.method === 'GET') {
    const challenge = await signChallenge(key, url.origin, now());
    return text({ csrf: challenge, expires_in_seconds: 300 }, 200, {
      'set-cookie': `ifund_owner_csrf=${challenge}; Path=${ROUTE}; Max-Age=300; Secure; HttpOnly; SameSite=Strict`,
    });
  }
  const cookie = (request.headers.get('cookie') || '').split(';').map(x => x.trim())
    .find(x => x.startsWith('ifund_owner_csrf='))?.slice('ifund_owner_csrf='.length);
  const csrf = request.headers.get('x-ifund-csrf');
  if (!csrf || !cookie || csrf !== cookie || !(await validChallenge(key, csrf, url.origin, now()))) return deny();
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) return deny(415);
  let body;
  try { body = await boundedBody(request); } catch { return deny(400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || body.consent !== true) return deny(400);
  const sourceBearer = request.headers.get('x-ifund-base44-token');
  const auth = request.headers.get('authorization') || '';
  const destinationBearer = /^Bearer ([^\s]+)$/.exec(auth)?.[1];
  if (!tokenOK(sourceBearer) || !tokenOK(destinationBearer)) return deny(401);
  // Missing server-only credentials cannot be substituted with request values.
  if (!tokenOK(env.IFUND_SUPABASE_PUBLISHABLE_KEY) || !tokenOK(env.IFUND_SUPABASE_SERVICE_ROLE_KEY))
    return text({ error: 'not_configured' }, 503);
  const adapters = makeOwnerProofAdapters({
    sourceBearer, destinationBearer,
    supabasePublishableKey: env.IFUND_SUPABASE_PUBLISHABLE_KEY,
    supabaseServiceKey: env.IFUND_SUPABASE_SERVICE_ROLE_KEY, fetcher,
  });
  const result = await linkVerifiedOwnerSessions(adapters);
  if (!result.ok) return deny(result.reason === 'identity_provider_unavailable' || result.reason === 'storage_unavailable' ? 503 : 403);
  return text({ ok: true, linked: true, already_linked: result.alreadyLinked === true }, 200, {
    'set-cookie': `ifund_owner_csrf=; Path=${ROUTE}; Max-Age=0; Secure; HttpOnly; SameSite=Strict`,
  });
}
