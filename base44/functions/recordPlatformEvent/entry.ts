import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const CONVEX_PLATFORM_EVENT_URL = "https://rosy-butterfly-2.convex.site/platformEvent";

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const bridgeSecret = Deno.env.get("CONVEX_PLATFORM_BRIDGE_SECRET");
    if (!bridgeSecret) {
      return Response.json({ error: "Platform bridge is not configured" }, { status: 503 });
    }

    const input = await req.json();
    const required = [
      "eventId", "name", "actorId", "resourceType", "resourceId",
      "correlationId", "idempotencyKey", "occurredAt", "version", "payload",
    ];
    if (required.some((key) => input?.[key] == null || input[key] === "")) {
      return Response.json({ error: "Invalid platform event" }, { status: 400 });
    }

    if (String(input.actorId) !== String(user.id) && String(input.actorId) !== String(user.email)) {
      return Response.json({ error: "Actor does not match authenticated user" }, { status: 403 });
    }

    const response = await fetch(CONVEX_PLATFORM_EVENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform-bridge-secret": bridgeSecret,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return Response.json(
        { error: response.status === 401 ? "Platform bridge authorization failed" : "Authoritative event recording failed" },
        { status: response.status === 401 ? 502 : 502 },
      );
    }

    const json = await response.json().catch(() => ({}));
    return Response.json(json);
  } catch {
    return Response.json({ error: "Authoritative event recording failed" }, { status: 500 });
  }
}
