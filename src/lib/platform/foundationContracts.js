// Shared Platform Foundation contracts. Keep this module dependency-light so it can
// be used by UI, service helpers, and server-side Base44 functions without creating
// a second backend contract system.

const EVENT_VERSION = "1.0";
const MAX_ATTEMPTS = 5;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 5000;
const MAX_EVENT_PAYLOAD_BYTES = 16 * 1024;
const MAX_EVENT_STRING_LENGTH = 256;

export const PLATFORM_EVENT_NAMES = Object.freeze([
  "platform.health.check",
  "platform.feature.flag.updated",
  "platform.knowledge.published",
  "platform.agent.interaction.recorded",
  "platform.connection.synced",
  "platform.campaign.updated",
  "platform.payment.updated",
]);

const SAFE_ERROR_MESSAGES = Object.freeze({
  UNAVAILABLE: "The platform service is temporarily unavailable. Please try again.",
  UNAUTHORIZED: "You are not authorized to perform this action.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested platform resource was not found.",
  CONFLICT: "The platform could not apply this change because the request conflicts with a newer update.",
  RATE_LIMITED: "Too many requests. Please try again shortly.",
  VALIDATION: "The platform request could not be validated.",
});

function assertBoundedString(value, name, maxLength = MAX_EVENT_STRING_LENGTH) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  if (value.length > maxLength) throw new RangeError(`${name} exceeds the maximum length`);
  return value.trim();
}

function stableSerialize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
}

function assertJsonPayload(payload) {
  let serialized;
  try {
    serialized = stableSerialize(payload);
  } catch {
    throw new TypeError("Event payload must be JSON serializable");
  }
  if (serialized === undefined) throw new TypeError("Event payload must be JSON serializable");
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > MAX_EVENT_PAYLOAD_BYTES) throw new RangeError("Event payload exceeds the maximum size");
  return payload;
}

export function validatePlatformEvent({
  name,
  version = EVENT_VERSION,
  timestamp = new Date().toISOString(),
  actorId,
  resourceType,
  resourceId,
  correlationId,
  idempotencyKey,
  payload = {},
}) {
  if (!PLATFORM_EVENT_NAMES.includes(name)) throw new Error(`Unregistered platform event: ${name}`);
  assertBoundedString(version, "version");
  assertBoundedString(timestamp, "timestamp");
  if (Number.isNaN(Date.parse(timestamp))) throw new TypeError("timestamp must be a valid ISO date");
  assertBoundedString(actorId, "actorId");
  assertBoundedString(resourceType, "resourceType");
  assertBoundedString(resourceId, "resourceId");
  assertBoundedString(correlationId, "correlationId");
  assertBoundedString(idempotencyKey, "idempotencyKey");
  assertJsonPayload(payload);
  return Object.freeze({
    name,
    version,
    timestamp,
    actorId,
    resourceType,
    resourceId,
    correlationId,
    idempotencyKey,
    payload,
  });
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
 * @property {string} [idempotencyKey]
 * @property {(error: unknown, attempt: number) => boolean} [shouldRetry]
 */

/**
 * @param {(context: {attempt: number, idempotencyKey: string}) => Promise<unknown>} task
 * @param {RetryOptions} [options]
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

function assertFinitePositiveInteger(value, fallback, max) {
  const candidate = Number.isFinite(value) ? Math.floor(value) : fallback;
  if (candidate < 1 || candidate > max) throw new RangeError(`maxAttempts must be between 1 and ${max}`);
  return candidate;
}

function assertFiniteNonNegativeNumber(value, fallback, max) {
  const candidate = Number.isFinite(value) ? value : fallback;
  if (candidate < 0 || candidate > max) throw new RangeError(`backoffMs must be between 0 and ${max}`);
  return candidate;
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
