import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const CONVEX_MUTATION_URL = "https://rosy-butterfly-2.convex.cloud/api/mutation";
const CONVEX_MUTATION_PATH = "platformFoundation:recordPlatformEvent";

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const input = await req.json();
    const required = [
      "eventId",
      "name",
      "actorId",
      "resourceType",
      "resourceId",
      "correlationId",
      "idempotencyKey",
      "occurredAt",
      "version",
      "payload",
    ];
    for (const key of required) {
      if (input?.[key] == null || input[key] === "") {
        return Response.json({ error: `Missing ${key}` }, { status: 400 });
      }
    }

    if (String(input.actorId) !== String(user.id) && String(input.actorId) !== String(user.email)) {
      return Response.json({ error: "Actor does not match authenticated user" }, { status: 403 });
    }

    const response = await fetch(CONVEX_MUTATION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: CONVEX_MUTATION_PATH,
        args: input,
        format: "json",
      }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.status === "error") {
      return Response.json({ error: "Authoritative event recording failed" }, { status: 502 });
    }

    return Response.json(json.status === "success" ? json.value : json);
  } catch {
    return Response.json({ error: "Authoritative event recording failed" }, { status: 500 });
  }
}
