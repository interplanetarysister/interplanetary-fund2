import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Convex cloud backend — source of truth for agents, campaigns, treasury, protocol.
const CONVEX_QUERY_URL = "https://rosy-butterfly-2.convex.cloud/api/query";

async function convexQuery(path) {
  const res = await fetch(CONVEX_QUERY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args: {}, format: "json" }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === "error") {
    throw new Error(`Convex ${path} failed: ${json.errorMessage || res.status}`);
  }
  // Convex REST returns { status: "success", value } — but tolerate a bare value.
  return json.status === "success" ? json.value : json;
}

const num = (v) => (typeof v === "number" ? v : Number(v) || 0);
const str = (v) => (v == null ? "" : String(v));

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const db = base44.asServiceRole.entities;
    const now = new Date().toISOString();

    const [agents, campaigns, treasury, reports] = await Promise.all([
      convexQuery("agents:getAgents").catch((e) => { console.warn(e.message); return []; }),
      convexQuery("campaigns:getCampaigns").catch((e) => { console.warn(e.message); return []; }),
      convexQuery("treasury:aggregateBalances").catch((e) => { console.warn(e.message); return null; }),
      convexQuery("protocol:getReports").catch((e) => { console.warn(e.message); return []; }),
    ]);

    const counts = { agents: 0, campaigns: 0, reports: 0, treasury: false };

    // --- Agents: match by name ---
    if (Array.isArray(agents) && agents.length) {
      const existing = await db.Agent.list(undefined, 200);
      for (const a of agents) {
        const name = str(a.name);
        if (!name) continue;
        const data = {
          name,
          role: str(a.role),
          status: str(a.status || "active"),
          trust_score: num(a.trust_score ?? a.trustScore ?? a.trust),
          description: str(a.description || a.mission || ""),
          last_synced: now,
        };
        const match = existing.find((e) => e.name === name);
        if (match) await db.Agent.update(match.id, data);
        else await db.Agent.create(data);
        counts.agents++;
      }
    }

    // --- Campaigns: match by if_campaign_id ---
    if (Array.isArray(campaigns) && campaigns.length) {
      const existing = await db.MonitoredCampaign.list(undefined, 200);
      for (const c of campaigns) {
        const ifId = str(c.if_campaign_id ?? c.ifCampaignId ?? c._id ?? c.id);
        if (!ifId) continue;
        const ai = c.ai_profile || {};
        const data = {
          if_campaign_id: ifId,
          title: str(c.title || c.name || "Untitled"),
          goal_amount: num(c.goal_amount ?? c.goal ?? c.goalAmount),
          raised_amount: num(c.raised_amount ?? c.raised ?? c.raisedAmount),
          status: str(c.status || "active"),
          outreach_enabled: Boolean(c.outreach_enabled ?? c.outreachEnabled),
          payment_active: Boolean(c.payment_active ?? c.paymentActive),
          story_present: Boolean(c.story_present ?? c.storyPresent ?? c.story),
          cover_image_present: Boolean(c.cover_image_present ?? c.coverImagePresent ?? c.cover_image_url),
          ai_ideal_donors: str(c.ai_ideal_donors ?? c.aiIdealDonors ?? ai.ideal_donors ?? ""),
          ai_interested_orgs: str(c.ai_interested_orgs ?? c.aiInterestedOrgs ?? ai.interested_orgs ?? ""),
          last_synced: now,
        };
        const match = existing.find((e) => e.if_campaign_id === ifId);
        if (match) await db.MonitoredCampaign.update(match.id, data);
        else await db.MonitoredCampaign.create(data);
        counts.campaigns++;
      }
    }

    // --- Treasury: keep a single latest snapshot ---
    if (treasury && typeof treasury === "object") {
      const totals = {
        total_raised: num(treasury.total_raised ?? treasury.totalRaised ?? treasury.raised),
        total_held: num(treasury.total_held ?? treasury.totalHeld ?? treasury.held),
        total_fees: num(treasury.total_fees ?? treasury.totalFees ?? treasury.fees),
        net_position: num(treasury.net_position ?? treasury.netPosition ?? treasury.net),
        campaign_totals: (treasury.campaign_totals ?? treasury.campaigns ?? treasury.byCampaign ?? []).map((t) => ({
          campaign: str(t.campaign ?? t.title ?? t.name),
          raised: num(t.raised ?? t.raised_amount),
          held: num(t.held ?? t.held_amount),
          fees: num(t.fees ?? t.fee_amount),
        })),
        synced_at: now,
      };
      const snaps = await db.TreasurySnapshot.list("-created_date", 1);
      if (snaps.length) await db.TreasurySnapshot.update(snaps[0].id, totals);
      else await db.TreasurySnapshot.create(totals);
      counts.treasury = true;
    }

    // --- Protocol reports: match by report_id ---
    if (Array.isArray(reports) && reports.length) {
      const existing = await db.ProtocolReport.list(undefined, 200);
      for (const r of reports) {
        const rid = str(r._id ?? r.report_id ?? r.id);
        if (!rid) continue;
        const data = {
          report_id: rid,
          title: str(r.title || "Protocol Audit"),
          summary: str(r.summary || r.notes || ""),
          passed_count: num(r.passed_count ?? r.passed ?? r.passedCount),
          failed_count: num(r.failed_count ?? r.failed ?? r.failedCount),
          results: (r.results ?? r.checks ?? []).map((x) => ({
            campaign: str(x.campaign ?? x.campaign_title ?? x.title),
            standard: str(x.standard ?? x.code ?? x.rule),
            passed: Boolean(x.passed ?? x.ok),
            detail: str(x.detail ?? x.message ?? ""),
          })),
          generated_at: r.generated_at || r.generatedAt || (r._creationTime ? new Date(r._creationTime).toISOString() : now),
          last_synced: now,
        };
        const match = existing.find((e) => e.report_id === rid);
        if (match) await db.ProtocolReport.update(match.id, data);
        else await db.ProtocolReport.create(data);
        counts.reports++;
      }
    }

    return Response.json({ ok: true, synced_at: now, counts });
  } catch (error) {
    console.error('syncFromConvex error:', error.message);
    return Response.json({ error: 'Unable to sync from the cloud backend.' }, { status: 500 });
  }
}