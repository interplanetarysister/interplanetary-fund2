/**
 * Shared Platform Foundation contracts.
 *
 * These helpers define the minimum shape for cross-OS events and retry-safe
 * asynchronous work. They are intentionally transport-agnostic so the
 * application layer can share one convention without becoming a competing
 * persistent backend or event store.
 */

const EVENT_VERSION = 1;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 250;

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createPlatformEvent({
  name,
  actorId,
  resourceType,
  resourceId,
  correlationId = createId(),
  idempotencyKey,
  payload = {},
  occurredAt = new Date().toISOString(),
  version = EVENT_VERSION,
}) {
  if (!name || !actorId || !resourceType || !resourceId || !idempotencyKey) {
    throw new Error("Platform events require name, actorId, resourceType, resourceId, and idempotencyKey");
  }

  return {
    id: createId(),
    name,
    version,
    occurred_at: occurredAt,
    actor_id: actorId,
    resource_type: resourceType,
    resource_id: resourceId,
    correlation_id: correlationId,
    idempotency_key: idempotencyKey,
    payload,
  };
}

export function createIdempotencyKey(...parts) {
  const normalized = parts
    .flatMap((part) => (part == null ? [] : [String(part).trim()]))
    .filter(Boolean);
  if (!normalized.length) throw new Error("At least one value is required for an idempotency key");
  return normalized.join(":");
}

export async function withRetry(task, {
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  backoffMs = DEFAULT_BACKOFF_MS,
  shouldRetry = () => true,
} = {}) {
  const attempts = Math.max(1, Math.floor(maxAttempts));
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error, attempt)) throw error;
      await new Promise((resolve) => setTimeout(resolve, backoffMs * 2 ** (attempt - 1)));
    }
  }

  throw lastError;
}

export function sanitizePlatformError(error, fallback = "Operation unavailable") {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  if (!message) return fallback;
  return message.slice(0, 180);
}

export const PLATFORM_FOUNDATION = Object.freeze({
  eventVersion: EVENT_VERSION,
  defaultMaxAttempts: DEFAULT_MAX_ATTEMPTS,
  defaultBackoffMs: DEFAULT_BACKOFF_MS,
});
