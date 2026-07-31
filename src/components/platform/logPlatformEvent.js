import { base44 } from "@/api/base44Client";

export async function logPlatformEvent({ action, category, affected_resource, outcome = "success", details }) {
  const me = await base44.auth.me();
  return base44.entities.PlatformEvent.create({
    action,
    category,
    affected_resource,
    outcome,
    details,
    actor_name: me.full_name || me.email,
  });
}