import { createClientFromRequest } from "npm:@base44/sdk@0.8.53";
import { assertActiveAccount } from "../../shared/accountGuard.ts";

// Admin-only gateway to the dedicated inbound Cloudflare Email Worker.
// MAIL_API_TOKEN is never exposed to the browser, mobile package, or GitHub.
const EMAIL_ID = /^[a-f0-9]{64}$/;
const clean = (value: unknown, max: number) => String(value ?? "").slice(0, max);

export default async function (req: Request) {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    if (guard.user.role !== "admin") {
      return Response.json({ error: "Administrator only" }, { status: 403 });
    }

    const base = (Deno.env.get("IFUND_MAIL_WORKER_URL") || "").trim();
    const token = Deno.env.get("IFUND_MAIL_API_TOKEN") || "";
    if (!base || token.length < 32) {
      return Response.json({ configured: false, error: "Company email is awaiting connection." }, { status: 503 });
    }
    const origin = new URL(base);
    if (origin.protocol !== "https:" || origin.username || origin.password ||
        origin.search || origin.hash || !["", "/"].includes(origin.pathname)) {
      return Response.json({ configured: false, error: "Mail server settings are invalid." }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action || "list", 20);
    const id = clean(body?.id, 80);
    const limit = Math.min(100, Math.max(1, Number(body?.limit) || 50));
    let method = "GET";
    let path = "/api/messages?limit=" + Math.floor(limit);

    if (action === "get" || action === "read") {
      if (!EMAIL_ID.test(id)) return Response.json({ error: "Invalid message ID" }, { status: 400 });
      path = "/api/messages/" + id;
      if (action === "read") { method = "POST"; path += "/read"; }
    } else if (action !== "list") {
      return Response.json({ error: "Unsupported mailbox action" }, { status: 400 });
    }

    const upstream = await fetch(new URL(path, origin).toString(), {
      method,
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      console.error("Mailbox upstream unavailable:", upstream.status);
      return Response.json({ error: "Company email could not be loaded." }, { status: 503 });
    }
    const result = await upstream.json();
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Company mailbox read failed:", error?.name || "UnknownError");
    return Response.json({ error: "Company email is temporarily unavailable." }, { status: 503 });
  }
}
