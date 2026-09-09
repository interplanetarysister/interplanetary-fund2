import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ShieldAlert, ShieldCheck, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import IntegrationsTable from "@/components/admin/IntegrationsTable";
import IntegrationDetailPanel from "@/components/admin/IntegrationDetailPanel";
import PageError from "@/components/PageError";
import { STATUS_BADGE } from "@/lib/integrationRegistryUi";

const SAFE_REGISTRY_ERROR = "We couldn't load the integration registry. Please try again.";
const SAFE_HEALTH_ERROR = "We couldn't complete the integration health check. Please try again.";

function isAdminUser(value) {
  return Boolean(value && typeof value === "object" && value.role === "admin");
}

function isRegistryResponse(value) {
  return Array.isArray(value) && value.every((entry) => entry && typeof entry === "object");
}

function isHealthResponse(value) {
  return Boolean(value && typeof value === "object" && value.data && typeof value.data === "object" && !Array.isArray(value.data));
}

export default function IntegrationsAdmin() {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [checking, setChecking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestGeneration = useRef(0);
  const mounted = useRef(true);

  const loadRegistry = useCallback(async () => {
    const generation = ++requestGeneration.current;
    try {
      const me = await base44.auth.me();
      if (!mounted.current || generation !== requestGeneration.current) return;
      if (!me || typeof me !== "object" || typeof me.role !== "string") throw new Error("Malformed auth response");
      setUser(me);
      if (!isAdminUser(me)) return;
      const list = await base44.entities.PlatformAccessRegistry.list("-platform", 200);
      if (!isRegistryResponse(list)) throw new Error("Malformed registry response");
      if (!mounted.current || generation !== requestGeneration.current) return;
      setEntries(list);
      setError(null);
    } catch (e) {
      console.error("IntegrationsAdmin registry load failed:", e?.name || "UnknownError");
      if (!mounted.current || generation !== requestGeneration.current) return;
      setError(SAFE_REGISTRY_ERROR);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadRegistry();
    return () => {
      mounted.current = false;
      requestGeneration.current += 1;
    };
  }, [loadRegistry, refreshKey]);

  const reload = () => setRefreshKey((k) => k + 1);

  const runHealthCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const response = await base44.functions.invoke("validateIntegrationHealth", {});
      if (!isHealthResponse(response)) throw new Error("Malformed health response");
      reload();
    } catch (e) {
      console.error("IntegrationsAdmin health check failed:", e?.name || "UnknownError");
      if (mounted.current) setError(SAFE_HEALTH_ERROR);
    } finally {
      if (mounted.current) setChecking(false);
    }
  };

  if (!user) return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading integration registry</span></div>;

  if (!isAdminUser(user)) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6">
        <ShieldAlert className="w-10 h-10 text-stone-300 mx-auto" />
        <h1 className="font-display text-2xl text-stone-900 mt-4">Administrators only</h1>
        <p className="text-stone-500 mt-2">The integration registry is restricted to platform administrators.</p>
      </div>
    );
  }

  if (error) return <div className="max-w-6xl mx-auto px-4 py-10"><PageError message={error} onRetry={() => { setError(null); reload(); }} /></div>;
  if (!entries) return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading integration registry</span></div>;

  const needsAttention = entries.filter((e) => e.status && e.status !== "ACTIVE");
  const counts = entries.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Integration Registry</h1>
          <p className="text-stone-500 mt-1">One secure source of truth for external-platform access — status, health, authorized agents, and reauthorization.</p>
        </div>
        <Button onClick={runHealthCheck} disabled={checking} className="rounded-xl" aria-busy={checking}>
          {checking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
          {checking ? "Checking…" : "Run health check"}
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
