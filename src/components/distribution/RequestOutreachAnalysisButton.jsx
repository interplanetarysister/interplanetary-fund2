import React, { useState } from "react";
import { base44 } from "@/api/base44Client";

export default function RequestOutreachAnalysisButton({ campaign }) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState("");
  if (!campaign?.outreach_enabled || campaign?.outreach_paused || campaign?.status !== "active") return null;
  async function requestAnalysis() {
    if (busy) return;
    setBusy(true);
    setOutcome("");
    try {
      const response = await base44.functions.invoke("runOutreachAgent", { campaign_id: campaign.id });
      const data = response?.data || response;
      if (data?.error) throw new Error(data.error);
      const entry = (data?.processed || []).find(p => p.id === campaign.id);
      setOutcome(entry?.recommendations
        ? "Your outreach recommendations are ready to review with your AI team. Nothing was posted."
        : entry?.skipped
          ? "No new outreach recommendations: " + entry.skipped
          : "No recommendations were generated. Review this campaign's outreach settings.");
    } catch {
      setOutcome("The analysis was not confirmed. Check your campaign settings before requesting it again.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="my-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
    <button type="button" onClick={requestAnalysis} disabled={busy}
      className="min-h-11 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
      {busy ? "Preparing outreach guidance…" : "Request outreach guidance"}
    </button>
    <p className="mt-1 text-xs text-sky-950">Runs only when you request it. Recommendations and drafts are never automatically published.</p>
    {outcome && <p role="status" className="mt-2 text-sm text-sky-950">{outcome}</p>}
  </div>;
}
