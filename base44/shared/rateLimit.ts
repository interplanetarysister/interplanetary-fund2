// Persistent fixed-window rate limiter backed by the RateLimitBucket entity.
// Service-scoped (writes/reads via base44.asServiceRole) so it works from any
// backend function. Returns { allowed, remaining, retryAfterSeconds }.
// Use a stable key that identifies the actor + action, e.g.
// `sendCommunication:<userId>`. Fails OPEN: a limiter outage never blocks a
// legitimate request.

function diagnosticType(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'function') return 'function';
  if (typeof value !== 'object') return typeof value;
  try {
    return Object.prototype.toString.call(value).slice(8, -1).toLowerCase() || 'object';
  } catch {
    return 'object';
  }
}

export async function checkRateLimit(base44, key, max, windowSeconds) {
  try {
    const sr = base44.asServiceRole;
    const now = Date.now();
    const existing = await sr.entities.RateLimitBucket.filter({ key }, '-created_date', 1);
    const bucket = existing && existing[0];
    const windowStartMs = bucket ? new Date(bucket.window_start).getTime() : 0;
    const expired = !bucket || windowStartMs + windowSeconds * 1000 <= now;

    if (expired) {
      const data = { key, window_start: new Date(now).toISOString(), count: 1 };
      if (bucket) {
        await sr.entities.RateLimitBucket.update(bucket.id, data);
      } else {
        await sr.entities.RateLimitBucket.create(data);
      }
      return { allowed: true, remaining: Math.max(0, max - 1), retryAfterSeconds: 0 };
    }

    if (bucket.count < max) {
      await sr.entities.RateLimitBucket.updateMany({ id: bucket.id }, { $inc: { count: 1 } });
      return { allowed: true, remaining: Math.max(0, max - bucket.count - 1), retryAfterSeconds: 0 };
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + windowSeconds * 1000 - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  } catch (error) {
    console.error('checkRateLimit failed (failing open):', { diagnostic_type: diagnosticType(error) });
    return { allowed: true, remaining: 0, retryAfterSeconds: 0 };
  }
}
