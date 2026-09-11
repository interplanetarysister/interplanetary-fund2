// Persistent fixed-window rate limiter backed by the RateLimitBucket entity.
// Service-scoped (writes/reads via base44.asServiceRole) so it works from any
// backend function. Returns { allowed, remaining, retryAfterSeconds }.
// Use a stable key that identifies the actor + action, e.g.
// `sendCommunication:<userId>`. Fails OPEN: a limiter outage never blocks a
// legitimate request.

const MAX_KEY_LENGTH = 256;
const MAX_WINDOW_SECONDS = 7 * 24 * 60 * 60;
const MAX_LIMIT = 1000000;

function diagnosticType(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'function') return 'function';
  if (typeof value !== 'object') return typeof value;
  return Object.prototype.toString.call(value).slice(8, -1).toLowerCase() || 'object';
}

function safeKey(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_KEY_LENGTH && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}

function safePositiveInteger(value, max) {
  return Number.isInteger(value) && value > 0 && value <= max ? value : null;
}

export async function checkRateLimit(base44, key, max, windowSeconds) {
  const normalizedKey = safeKey(key);
  const normalizedMax = safePositiveInteger(max, MAX_LIMIT);
  const normalizedWindow = safePositiveInteger(windowSeconds, MAX_WINDOW_SECONDS);

  if (!normalizedKey || !normalizedMax || !normalizedWindow) {
    return { allowed: true, remaining: 0, retryAfterSeconds: 0 };
  }

  try {
    const sr = base44.asServiceRole;
    const now = Date.now();
    const existing = await sr.entities.RateLimitBucket.filter({ key: normalizedKey }, '-created_date', 1);
    const bucket = existing && existing[0];
    const windowStartMs = bucket ? new Date(bucket.window_start).getTime() : 0;
    const expired = !bucket || !Number.isFinite(windowStartMs) || windowStartMs + normalizedWindow * 1000 <= now;

    if (expired) {
      const data = { key: normalizedKey, window_start: new Date(now).toISOString(), count: 1 };
      if (bucket) {
        await sr.entities.RateLimitBucket.update(bucket.id, data);
      } else {
        await sr.entities.RateLimitBucket.create(data);
      }
      return { allowed: true, remaining: Math.max(0, normalizedMax - 1), retryAfterSeconds: 0 };
    }

    const currentCount = Number.isInteger(bucket.count) && bucket.count >= 0 ? bucket.count : normalizedMax;
    if (currentCount < normalizedMax) {
      await sr.entities.RateLimitBucket.updateMany({ id: bucket.id }, { $inc: { count: 1 } });
      return { allowed: true, remaining: Math.max(0, normalizedMax - currentCount - 1), retryAfterSeconds: 0 };
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + normalizedWindow * 1000 - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  } catch (error) {
    console.error('checkRateLimit failed (failing open):', { diagnostic_type: diagnosticType(error) });
    return { allowed: true, remaining: 0, retryAfterSeconds: 0 };
  }
}
