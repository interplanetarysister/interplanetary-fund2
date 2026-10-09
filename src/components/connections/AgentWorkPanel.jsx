import React, { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

const ACTIVE = new Set(["requested", "assigned", "in_progress", "waiting_user", "waiting_external", "needs_review"]);
const format = (state) => ({
  requested: "Queued",
  assigned: "Assigned",
  in_progress: "Checking",
  waiting_user: "Needs your help",
  waiting_external: "Waiting for provider",
  needs_review: "Needs review",
  completed: "Verified",
  failed: "Failed",
  cancelled: "Cancelled",
  superseded: "Replaced",
}[state] || "Unknown");

export default function AgentWorkPanel({ refreshKey = 0 }) {
  const [work, setWork] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState("");
  const sweepInFlight = useRef(false);
  const load = useCallback(async () => {
    try {
      const response = await base44.functions.invoke("manageAgentWork", { mode: "list" });
      if (!response?.data?.ok || !Array.isArray(response.data.work)) throw new Error("Invalid work status");
      setWork(response.data.work);
      setError("");
      return response.data.work;
    } catch {
      setError("AI connection work could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  // A safe, owner-authorized foreground worker checks a small number of due
  // connections. It never creates accounts, posts, spends, or bypasses provider
  // authorization. Runs only while the owner is viewing this page.
  const sweep = useCallback(async () => {
    if (sweepInFlight.current || document.visibilityState === "hidden") return;
    sweepInFlight.current = true;
    try {
      const rows = await load();
      const due = (rows || []).filter((item) =>
        ["in_progress", "waiting_external"].includes(item.status) &&
        item.connection_id &&
        (!item.last_attempt_at || Date.now() - Date.parse(item.last_attempt_at) >= 5 * 60 * 1000)
      ).slice(0, 2);
      if (due.length) {
        await Promise.allSettled(due.map((item) =>
          base44.functions.invoke("manageAgentWork", { mode: "advance", delegation_id: item.id })
        ));
        await load();
      }
    } finally { sweepInFlight.current = false; }
  }, [load]);

  useEffect(() => {
    let active = true;
    const refresh = () => { if (active && document.visibilityState !== "hidden") void load(); };
    refresh();
    void sweep();
    const statusTimer = window.setInterval(refresh, 15000);
    const workTimer = window.setInterval(() => { if (active) void sweep(); }, 180000);
    return () => { active = false; window.clearInterval(statusTimer); window.clearInterval(workTimer); };
  }, [load, refreshKey, sweep]);

  const advance = async (item) => {
    if (checking) return;
    setChecking(item.id);
    try {
      const response = await base44.functions.invoke("manageAgentWork", {
        mode: "advance", delegation_id: item.id,
      });
      if (!response?.data?.ok) throw new Error("Unable to check");
      await load();
    } catch {
      setError("The provider check could not run. Your saved request is still available.");
    } finally {
      setChecking("");
    }
  };

  if (loading) return <div className="text-sm text-slate-500 py-3" role="status">Loading AI activity…</div>;
  if (!work.length && !error) return null;
  return (
    <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Managed connection activity">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="font-semibold text-slate-950">IFund AI work</h2>
          <p className="text-xs text-slate-600">Each request shows what IFund actually checked, and what still needs attention.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700 mb-3">{error}</p>}
      <div className="space-y-3">
        {work.slice(0, 8).map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-950 break-words">{item.objective || "Connection request"}</p>
              <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{format(item.status)}</span>
            </div>
            {item.result_summary && <p className="text-xs text-slate-700 mt-2 break-words">{item.result_summary}</p>}
            {ACTIVE.has(item.status) && item.external_requirement && <p className="text-xs text-amber-800 mt-1 break-words">Next: {item.external_requirement}</p>}
            {ACTIVE.has(item.status) && item.connection_id && (
              <Button type="button" size="sm" variant="outline" className="mt-2" disabled={checking === item.id} onClick={() => advance(item)}>
                {checking === item.id && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Check connection now
              </Button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
