import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { assertPlatformAccess, resolveConvex } from '../../shared/integrationRegistry.ts';

// Convex cloud backend — source of truth for agents, campaigns, treasury,
// protocol. The endpoint URL and (optional) auth token are read from the
// centralized secret-reference system (CONVEX_QUERY_URL / CONVEX_AUTH_TOKEN),
// NOT hardcoded. Access is gated through the Platform Access Registry.

async function convexQuery(path, args = {}) {
  const resolved = resolveConvex(secrets.get('CONVEX_QUERY_URL'));
  if (!resolved.url) throw new Error('Convex endpoint not configured (CONVEX_QUERY_URL).');
  const headers = { 'Content-Type': 'application/json' };
  // Only the dedicated CONVEX_AUTH_TOKEN is used for query auth. The token that
  // may ride along in a "dev:<dep>|<token>" deployment reference is a CLI/admin
  // token, not a query-auth credential — sending it as a bearer causes 401.
  const token = secrets.get('CONVEX_AUTH_TOKEN');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(resolved.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ path, args, format: "json" }),
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
    const sr = base44.asServiceRole;
    const db = sr.entities;

    // Centralized access gate: refuse to sync if the Convex registry entry is
    // revoked/disconnected/misconfigured. The endpoint itself is read from
    // CONVEX_QUERY_URL below, so the sync can no longer bypass central config.
    const access = await assertPlatformAccess(sr, 'convex');
    if (!access.ok) {
      return Response.json({ ok: false, skipped: true, reason: access.reason, status: access.status }, { status: 403 });
    }
    const convexResolved = resolveConvex(secrets.get('CONVEX_QUERY_URL'));
    if (!convexResolved.url) {
      return Response.json({ ok: false, skipped: true, reason: 'CONVEX_QUERY_URL not configured or malformed' }, { status: 503 });
    }

    const now = new Date().toISOString();

    const queryErrors = [];
    const tryQuery = (p, a, fallback) => convexQuery(p, a).catch((e) => { queryErrors.push(`${p}: ${e.message}`); return fallback; });
    const [agents, campaigns, treasury, reports] = await Promise.all([
      tryQuery("agents:getAgents", undefined, []),
      // getCampaigns is paginated — it requires paginationOpts and returns
      // { page, continueCursor, isDone }, not a bare array.
      tryQuery("campaigns:getCampaigns", { paginationOpts: { numItems: 100, cursor: null } }, []),
      tryQuery("treasury:aggregateBalances", undefined, null),
      tryQuery("protocol:getReports", { limit: 20 }, []),
    ]);
    // If every query failed, the sync did not actually run — surface the real
    // reason instead of silently reporting success with zero counts.
    if (queryErrors.length === 4) {
      return Response.json({ ok: false, skipped: true, reason: 'All Convex queries failed', errors: queryErrors }, { status: 502 });
    }

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
    // getCampaigns returns a paginated { page, ... } result; normalize to array.
    const campaignList = Array.isArray(campaigns) ? campaigns : (campaigns && Array.isArray(campaigns.page) ? campaigns.page : []);
    if (campaignList.length) {
      const existing = await db.MonitoredCampaign.list(undefined, 200);
      for (const c of campaignList) {
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
      // Convex treasury aggregate shape: { grandTotal: {raised,held,donors},
      // holdingAccounts: {totalHeld,totalFees,totalPaidOut,netPosition}, localCampaigns,
      // externalPlatforms }. Map the real fields, falling back to legacy snake/camel names.
      const g = treasury.grandTotal || {};
      const h = treasury.holdingAccounts || {};
      const totals = {
        total_raised: num(g.raised ?? treasury.total_raised ?? treasury.totalRaised ?? treasury.raised),
        total_held: num(h.totalHeld ?? g.held ?? treasury.total_held ?? treasury.totalHeld ?? treasury.held),
        total_fees: num(h.totalFees ?? treasury.total_fees ?? treasury.totalFees ?? treasury.fees),
        net_position: num(h.netPosition ?? treasury.net_position ?? treasury.netPosition ?? treasury.net),
        campaign_totals: (treasury.campaign_totals ?? treasury.byCampaign ?? treasury.campaigns ?? []).map((t) => ({
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
        // Convex protocol report shape: reportType, auditDate, compliantCampaigns,
        // nonCompliantCampaigns, results:[{title, complianceScore, violations}].
        const data = {
          report_id: rid,
          title: str(r.reportType ?? r.title ?? "Protocol Audit"),
          summary: str(r.summary || r.notes || ""),
          passed_count: num(r.compliantCampaigns ?? r.passed_count ?? r.passed ?? r.passedCount),
          failed_count: num(r.nonCompliantCampaigns ?? r.failed_count ?? r.failed ?? r.failedCount),
          results: (r.results ?? r.checks ?? []).map((x) => ({
            campaign: str(x.title ?? x.campaign ?? x.campaign_title),
            standard: str(x.standard ?? x.code ?? x.rule ?? "compliance"),
            passed: Boolean(x.passed ?? x.ok ?? (x.violations === 0)),
            detail: str(x.detail ?? x.message ?? (x.complianceScore != null ? `complianceScore ${x.complianceScore}, ${x.violations ?? 0} violation(s)` : "")),
          })),
          generated_at: r.auditDate || r.generated_at || r.generatedAt || (r._creationTime ? new Date(r._creationTime).toISOString() : now),
          last_synced: now,
        };
        const match = existing.find((e) => e.report_id === rid);
        if (match) await db.ProtocolReport.update(match.id, data);
        else await db.ProtocolReport.create(data);
        counts.reports++;
      }
    }

    return Response.json({ ok: true, synced_at: now, counts, errors: queryErrors });
  } catch (error) {
    console.error('syncFromConvex error:', error.message);
    return Response.json({ error: 'Unable to sync from the cloud backend.' }, { status: 500 });
  }
}