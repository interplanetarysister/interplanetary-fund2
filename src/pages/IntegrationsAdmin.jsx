import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ShieldAlert, ShieldCheck, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import IntegrationsTable from "@/components/admin/IntegrationsTable";
import IntegrationDetailPanel from "@/components/admin/IntegrationDetailPanel";
import PageError from "@/components/PageError";
import { STATUS_BADGE } from "@/lib/integrationRegistryUi";

export default function IntegrationsAdmin() {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [checking, setChecking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);
        if (me.role !== "admin") return;
        const list = await base44.entities.PlatformAccessRegistry.list("-platform", 200);
        setEntries(list);
      } catch (e) {
        setError(e.message || "Couldn't load the integration registry.");
      }
    })();
  }, [refreshKey]);

  const reload = () => setRefreshKey((k) => k + 1);

  const runHealthCheck = async () => {
    setChecking(true);
    try {
      await base44.functions.invoke("validateIntegrationHealth", {});
      reload();
    } catch (e) {
      setError(e.message || "Health check failed.");
    }
    setChecking(false);
  };

  if (!user) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (user.role !== "admin") {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6">
        <ShieldAlert className="w-10 h-10 text-stone-300 mx-auto" />
        <h1 className="font-display text-2xl text-stone-900 mt-4">Administrators only</h1>
        <p className="text-stone-500 mt-2">The integration registry is restricted to platform administrators.</p>
      </div>
    );
  }

  if (error) return <div className="max-w-6xl mx-auto px-4 py-10"><PageError message={error} onRetry={() => { setError(null); setEntries(null); reload(); }} /></div>;
  if (!entries) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const needsAttention = entries.filter((e) => e.status && e.status !== "ACTIVE");
  const counts = entries.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Integration Registry</h1>
          <p className="text-stone-500 mt-1">One secure source of truth for external-platform access — status, health, authorized agents, and reauthorization.</p>
        </div>
        <Button onClick={runHealthCheck} disabled={checking} className="rounded-xl">
          {checking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
          Run health check
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        <Stat label="Registered" value={entries.length} />
        <Stat label="Active" value={counts.ACTIVE || 0} tone="emerald" />
        <Stat label="Need attention" value={needsAttention.length} tone={needsAttention.length ? "amber" : "stone"} />
        <Stat label="Misconfigured" value={counts.MISCONFIGURED || 0} tone={counts.MISCONFIGURED ? "red" : "stone"} />
      </div>

      {needsAttention.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
            <ShieldAlert className="w-4 h-4" />{needsAttention.length} integration(s) need attention
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-700">
            {needsAttention.map((e) => (
              <li key={e.id}>
                <button onClick={() => setSelected(e)} className="underline-offset-2 hover:underline">
                  {e.platform}
                </button>
                {" — "}{(STATUS_BADGE[e.status] || {}).label || e.status}{e.last_failure ? `: ${e.last_failure}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <IntegrationsTable entries={entries} onRowClick={setSelected} />
      </div>

      <IntegrationDetailPanel entry={selected} onClose={() => setSelected(null)} onUpdated={reload} />
    </div>
  );
}

function Stat({ label, value, tone = "stone" }) {
  const tones = {
    stone: "bg-white border-stone-200 text-stone-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide opacity-70">
        {tone === "emerald" && <ShieldCheck className="w-3.5 h-3.5" />}{label}
      </div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </div>
  );
}