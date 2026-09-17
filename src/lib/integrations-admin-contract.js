export const SAFE_AUTH_ERROR = "We couldn't verify administrator access.";
export const SAFE_AUTH_PAYLOAD_ERROR = "We couldn't verify the administrator account.";
export const SAFE_REGISTRY_ERROR = "We couldn't load the integration registry.";
export const SAFE_REGISTRY_UNAVAILABLE = "The integration registry is temporarily unavailable.";
export const SAFE_HEALTH_ERROR = "Health check failed.";

export function readAdminRole(value) {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return { kind: "malformed" };
  }
  try {
    return { kind: "role", role: value.role };
  } catch {
    return { kind: "malformed" };
  }
}

export function classifyRegistryResponse(value) {
  return Array.isArray(value)
    ? { kind: "ok", entries: value }
    : { kind: "unavailable", entries: null };
}

export function createSingleFlight() {
  let current = null;
  return {
    run(task) {
      if (current) return current;
      current = Promise.resolve().then(task).finally(() => {
        current = null;
      });
      return current;
    },
    get active() {
      return Boolean(current);
    },
  };
}
