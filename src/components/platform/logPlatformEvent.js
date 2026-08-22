import { base44 } from "@/api/base44Client";
import { createIdempotencyKey, createPlatformEvent } from "@/lib/platform/foundationContracts";

const EVENT_BY_CATEGORY = Object.freeze({
  configuration: "platform.configuration.changed",
  health_check: "platform.health_check.executed",
  knowledge: "platform.knowledge.updated",
  deployment: "platform.deployment.executed",
  security: "platform.security.action",
  recovery: "platform.recovery.executed",
  other: "platform.event.recorded",
});

/**
 * @typedef {Object} PlatformEventLogInput
 * @property {string} action
 * @property {string} [category]
 * @property {string} affected_resource
 * @property {string} [outcome]
 * @property {string} [details]
 * @property {string} [idempotency_key] Stable key for the logical side effect/event. Callers that may retry must provide one.
 */

/** @param {PlatformEventLogInput} input */
export async function logPlatformEvent({
  action,
  category = "other",
  affected_resource,
  outcome = "success",
  details,
  idempotency_key,
}) {
  const me = await base44.auth.me();
  const actorId = me.id || me.email;
  if (!actorId) throw new Error("Authenticated platform event actor is unavailable");
  const eventName = EVENT_BY_CATEGORY[category] || EVENT_BY_CATEGORY.other;
  const normalizedAction = String(action || "Platform event");
  const normalizedResource = String(affected_resource || "platform");
  const normalizedOutcome = String(outcome || "success");
  const normalizedDetails = details ? String(details) : "";
  if (!idempotency_key || typeof idempotency_key !== "string") {
    throw new Error("Platform event logging requires a stable idempotency key");
  }

  const event = createPlatformEvent({
    name: eventName,
    actorId,
    resourceType: "platform",
    resourceId: normalizedResource,
    idempotencyKey: createIdempotencyKey(idempotency_key),
    payload: {
      action: normalizedAction,
      category: String(category),
      outcome: normalizedOutcome,
      details: normalizedDetails.slice(0, 1000),
    },
  });

  const authoritative = await base44.functions.invoke("recordPlatformEvent", {
    eventId: event.id,
    name: event.name,
    actorId: event.actor_id,
    resourceType: event.resource_type,
    resourceId: event.resource_id,
    correlationId: event.correlation_id,
    idempotencyKey: event.idempotency_key,
    occurredAt: event.occurred_at,
    version: event.version,
    payload: JSON.stringify(event.payload),
  });

  const localRecord = await base44.entities.PlatformEvent.create({
    action: normalizedAction,
    category,
    affected_resource: normalizedResource,
    outcome: normalizedOutcome,
    details: normalizedDetails,
    actor_name: String(me.full_name || me.email || actorId),
    event_id: event.id,
    event_version: event.version,
    correlation_id: event.correlation_id,
    idempotency_key: event.idempotency_key,
    occurred_at: event.occurred_at,
  });

  return { localRecord, authoritative };
}
