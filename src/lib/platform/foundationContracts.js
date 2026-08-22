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
const MAX_ATTEMPTS = 5;
const DEFAULT_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 10_000;
const MAX_EVENT_PAYLOAD_BYTES = 32_000;
const MAX_EVENT_STRING_LENGTH = 256;

const PLATFORM_EVENT_NAMES = Object.freeze([
  "platform.configuration.changed",
  "platform.health_check.executed",
  "platform.knowledge.updated",
  "platform.deployment.executed",
  "platform.security.action",
  "platform.recovery.executed",
  "platform.event.recorded",
]);

const SAFE_ERROR_MESSAGES = Object.freeze({
  HEALTH_CHECK_TIMEOUT: "Dependency timed out",
  UNAUTHORIZED: "You are not authorized to perform this operation",
  FORBIDDEN: "This operation is not permitted",
  NOT_FOUND: "The requested resource was not found",
  RATE_LIMITED: "Too many requests; please try again",
  VALIDATION: "The request could not be validated",
  CONFLICT: "The operation conflicts with current state",
  UNAVAILABLE: "The service is temporarily unavailable",
});

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function assertFinitePositiveInteger(value, fallback, maximum) {
  if (value == null) return fallback;
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new TypeError("Expected a finite integer");
  }
  return Math.min(maximum, Math.max(1, value));
}

function assertFiniteNonNegativeNumber(value, fallback, maximum) {
  if (value == null) return fallback;
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError("Expected a finite non-negative number");
  }
  return Math.min(maximum, value);
}

function assertBoundedString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`Platform event ${field} must be a non-empty string`);
  }
  if (value.length > MAX_EVENT_STRING_LENGTH) {
    throw new RangeError(`Platform event ${field} exceeds the maximum length`);
  }
}

function assertIsoDate(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new TypeError("Platform event occurredAt must be a valid ISO timestamp");
  }
}

function assertPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("Platform event payload must be an object");
  }
  let serialized;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    throw new TypeError("Platform event payload must be JSON-serializable");
  }
  if (serialized.length > MAX_EVENT_PAYLOAD_BYTES) {
    throw new RangeError("Platform event payload exceeds the maximum size");
  }
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
  if (!PLATFORM_EVENT_NAMES.includes(name)) {
    throw new TypeError(`Unsupported platform event: ${String(name)}`);
  }
  assertBoundedString(String(actorId || ""), "actorId");
  assertBoundedString(String(resourceType || ""), "resourceType");
  assertBoundedString(String(resourceId || ""), "resourceId");
  assertBoundedString(String(correlationId || ""), "correlationId");
  assertBoundedString(String(idempotencyKey || ""), "idempotencyKey");
  if (version !== EVENT_VERSION) throw new Error(`Unsupported platform event version: ${String(version)}`);
  assertIsoDate(occurredAt);
  assertPayload(payload);

  return {
    id: createId(),
    name,
    version,
    occurred_at: occurredAt,
    actor_id: String(actorId),
    resource_type: String(resourceType),
    resource_id: String(resourceId),
    correlation_id: String(correlationId),
    idempotency_key: String(idempotencyKey),
    payload,
  };
}

export function createIdempotencyKey(...parts) {
  const normalized = parts
    .flatMap((part) => (part == null ? [] : [String(part).trim()]))
    .filter(Boolean);
  if (!normalized.length) throw new Error("At least one value is required for an idempotency key");
  const key = normalized.join(":");
  if (key.length > MAX_EVENT_STRING_LENGTH) throw new RangeError("Idempotency key exceeds the maximum length");
  return key;
}

/**
 * @typedef {Object} RetryOptions
 * @property {number} [maxAttempts]
 * @property {number} [backoffMs]
 * @property {string} idempotencyKey
 * @property {(error: unknown, attempt: number) => boolean} [shouldRetry]
 */

/**
 * @param {(context: {attempt: number, idempotencyKey: string}) => Promise<unknown>} task
 * @param {RetryOptions} options
 */
export async function withRetry(task, {
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  backoffMs = DEFAULT_BACKOFF_MS,
  idempotencyKey,
  shouldRetry = () => true,
} = {}) {
  if (typeof task !== "function") throw new TypeError("Retry task must be a function");
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new Error("Retryable side effects require an idempotencyKey");
  }
  assertBoundedString(idempotencyKey, "idempotencyKey");
  if (typeof shouldRetry !== "function") throw new TypeError("shouldRetry must be a function");

  const attempts = assertFinitePositiveInteger(maxAttempts, DEFAULT_MAX_ATTEMPTS, MAX_ATTEMPTS);
  const delay = assertFiniteNonNegativeNumber(backoffMs, DEFAULT_BACKOFF_MS, MAX_BACKOFF_MS);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task({ attempt, idempotencyKey });
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error, attempt)) throw error;
      const waitMs = Math.min(MAX_BACKOFF_MS, delay * 2 ** (attempt - 1));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError;
}

export function sanitizePlatformError(error, fallback = SAFE_ERROR_MESSAGES.UNAVAILABLE) {
  const code = String(error?.code || error?.status || error?.name || "").toUpperCase();
  if (SAFE_ERROR_MESSAGES[code]) return SAFE_ERROR_MESSAGES[code];
  if (code === "401" || code.includes("UNAUTHENTICATED")) return SAFE_ERROR_MESSAGES.UNAUTHORIZED;
  if (code === "403" || code.includes("FORBIDDEN")) return SAFE_ERROR_MESSAGES.FORBIDDEN;
  if (code === "404" || code.includes("NOT_FOUND")) return SAFE_ERROR_MESSAGES.NOT_FOUND;
  if (code === "409" || code.includes("CONFLICT")) return SAFE_ERROR_MESSAGES.CONFLICT;
  if (code === "429" || code.includes("RATE")) return SAFE_ERROR_MESSAGES.RATE_LIMITED;
  if (code.includes("VALID")) return SAFE_ERROR_MESSAGES.VALIDATION;
  return fallback;
}

export const PLATFORM_FOUNDATION = Object.freeze({
  eventVersion: EVENT_VERSION,
  eventNames: PLATFORM_EVENT_NAMES,
  defaultMaxAttempts: DEFAULT_MAX_ATTEMPTS,
  maxAttempts: MAX_ATTEMPTS,
  defaultBackoffMs: DEFAULT_BACKOFF_MS,
  maxBackoffMs: MAX_BACKOFF_MS,
  maxEventPayloadBytes: MAX_EVENT_PAYLOAD_BYTES,
  maxEventStringLength: MAX_EVENT_STRING_LENGTH,
});
