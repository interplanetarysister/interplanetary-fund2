import { base44 } from "@/api/base44Client";
import { createIdempotencyKey, createPlatformEvent } from "@/lib/platform/foundationContracts";

export async function logPlatformEvent({ action, category, affected_resource, outcome = "success", details, idempotency_key }) {
  const me = await base44.auth.me();
  const actorId = me.id || me.email;
  const event = createPlatformEvent({
    name: "platform.health_check.executed",
    actorId,
    resourceType: "platform",
    resourceId: "all-operating-systems",
    idempotencyKey: idempotency_key || createIdempotencyKey("platform-health-check", actorId, Date.now()),
    payload: {
      action: String(action || "Platform event"),
      category: String(category || "platform"),
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
