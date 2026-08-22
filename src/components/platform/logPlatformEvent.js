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

export async function logPlatformEvent({ action, category = "other", affected_resource, outcome = "success", details, idempotency_key }) {
  const me = await base44.auth.me();
  const actorId = me.id || me.email;
  const eventName = EVENT_BY_CATEGORY[category] || EVENT_BY_CATEGORY.other;
  const event = createPlatformEvent({
    name: eventName,
    actorId,
    resourceType: "platform",
    resourceId: String(affected_resource || "platform"),
    idempotencyKey: idempotency_key || createIdempotencyKey("platform-event", actorId, eventName, Date.now()),
    payload: {
      action: String(action || "Platform event"),
      category: String(category),
      outcome: String(outcome),
      details: details ? String(details).slice(0, 1000) : undefined,
    },
  });

  return base44.entities.PlatformEvent.create({
    action,
    category,
    affected_resource,
    outcome,
    details,
    actor_name: me.full_name || me.email,
    event_id: event.id,
    event_version: event.version,
    correlation_id: event.correlation_id,
    idempotency_key: event.idempotency_key,
    occurred_at: event.occurred_at,
  });
}
