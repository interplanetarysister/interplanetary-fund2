import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ShieldAlert, ShieldCheck, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import IntegrationsTable from "@/components/admin/IntegrationsTable";
import IntegrationDetailPanel from "@/components/admin/IntegrationDetailPanel";
import PayPalReceiptRecoveryPanel from "@/components/admin/PayPalReceiptRecoveryPanel";
import PageError from "@/components/PageError";
import { STATUS_BADGE, UNKNOWN_STATUS_BADGE, normalizeIntegrationStatus } from "@/lib/integrationRegistryUi";
import Base44ReleaseStatus from "@/components/admin/Base44ReleaseStatus";
import AdminOAuthProviderReadiness from "@/components/connections/AdminOAuthProviderReadiness";
import OwnerConnectorRoutePanel from "@/components/admin/OwnerConnectorRoutePanel";
import { Link, useLocation } from "react-router-dom";
import AIConnections from "./Connect";

const SAFE_REGISTRY_ERROR = "We couldn't load the integration registry. Please try again.";
const SAFE_HEALTH_ERROR = "We couldn't complete the integration health check. Please try again.";
const REQUEST_TIMEOUT_MS = 15000;

function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), REQUEST_TIMEOUT_MS)),
  ]);
}

function invokeWithLock(lock, operation) {
  if (lock.current) return null;
  lock.current = true;
  const pending = Promise.resolve().then(operation);
  pending.then(() => { lock.current = false; }, () => { lock.current = false; });
  return withTimeout(pending);
}

function isAdminUser(value) {
  return Boolean(value && typeof value === "object" && value.role === "admin");
}

function isRegistryResponse(value) {
  return Array.isArray(value) && value.every((entry) => entry && typeof entry === "object");
}

function normalizeRegistryEntries(value) {
  return value.map((entry) => ({ ...entry, status: normalizeIntegrationStatus(entry.status) }));
}

function isHealthResponse(value) {
  const data = value?.data || value;
  return Boolean(data && typeof data === "object" && data.ok === true && Number.isInteger(data.checked) && Array.isArray(data.report));
}

export default function IntegrationsAdmin() {
  const { search } = useLocation();
  const aiView = new URLSearchParams(search).get("view") === "ai";
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [entries, setEntries] = useState(null);
  const [registryError, setRegistryError] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [paypalHealth, setPaypalHealth] = useState(null);
  const [selected, setSelected] = useState(null);
  const [checking, setChecking] = useState(false);
  const [paypalRegistering, setPaypalRegistering] = useState(false);
  const [paypalRegistrationStatus, setPaypalRegistrationStatus] = useState('');
  const [paypalInventory, setPaypalInventory] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestGeneration = useRef(0);
  const mounted = useRef(true);
  const healthLock = useRef(false);
  const paypalRegisterLock = useRef(false);

  const loadRegistry = useCallback(async () => {
    const generation = ++requestGeneration.current;
    try {
      const me = await withTimeout(base44.auth.me());
      if (!mounted.current || generation !== requestGeneration.current) return;
      if (!me || typeof me !== "object" || typeof me.role !== "string") throw new Error("Malformed auth response");
      setUser(me);
      setAuthReady(true);
      if (!isAdminUser(me)) return;

      const list = await withTimeout(base44.entities.PlatformAccessRegistry.list("-platform", 200));
      if (!isRegistryResponse(list)) throw new Error("Malformed registry response");
      if (!mounted.current || generation !== requestGeneration.current) return;
      setEntries(normalizeRegistryEntries(list));
      setRegistryError(null);
    } catch (e) {
      console.error("IntegrationsAdmin registry load failed:", e?.name || "UnknownError");
      if (!mounted.current || generation !== requestGeneration.current) return;
      setAuthReady(true);
      setRegistryError(SAFE_REGISTRY_ERROR);
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

  useEffect(() => {
    if (!selected || !entries) return;
    const fresh = entries.find((entry) => entry.id === selected.id);
    setSelected(fresh || null);
  }, [entries, selected?.id]);

  const runHealthCheck = async () => {
    const request = invokeWithLock(healthLock, () => base44.functions.invoke("validateIntegrationHealth", {}));
    if (!request) return;
    setChecking(true);
    setHealthError(null);
    setPaypalHealth(null);
    try {
      const response = await request;
      if (!isHealthResponse(response)) throw new Error("Malformed health response");
      const report = response?.data || response;
      const paypal = report.report.find((item) => String(item.platform || '').toLowerCase() === 'paypal');
      if (mounted.current) setPaypalHealth(paypal || null);
      reload();
    } catch (e) {
      console.error("IntegrationsAdmin health check failed:", e?.name || "UnknownError");
      if (mounted.current) setHealthError(SAFE_HEALTH_ERROR);
    } finally {
      if (mounted.current) setChecking(false);
    }
  };

  const inspectExistingPayPalWebhooks = async () => {
    const request = invokeWithLock(paypalRegisterLock,
      () => base44.functions.invoke('setupPayPalCampaignWebhook', { inspect_only: true }));
    if (!request) return;
    setPaypalRegistering(true);
    setPaypalInventory(null);
    setPaypalRegistrationStatus('');
    try {
      const response = await request;
      const data = response?.data || response;
      if (data?.inspect_only !== true || !Array.isArray(data?.webhook_inventory))
        throw new Error('Provider webhook inventory was not verified.');
      if (mounted.current) {
        setPaypalInventory(data);
        setPaypalRegistrationStatus(
          'Existing PayPal webhooks: ' + data.existing_count +
          '. Matching campaign receivers: ' + data.matching_count +
          '. Inspection did not register or delete anything.'
        );
      }
    } catch (error) {
      console.error('PayPal webhook inspection:', error?.name || 'ProviderError');
      if (mounted.current) setPaypalRegistrationStatus(
        'PayPal did not return a verified webhook inventory. No registration was attempted.'
      );
    } finally {
      if (mounted.current) setPaypalRegistering(false);
    }
  };

  const registerPayPalCampaignWebhook = async () => {
    if (!paypalInventory || (paypalInventory.existing_count > 0 && paypalInventory.matching_count < 1)) {
      setPaypalRegistrationStatus('Review the existing PayPal webhooks first. Unrelated registrations must not be duplicated.');
      return;
    }
    const request = invokeWithLock(paypalRegisterLock, () => base44.functions.invoke('setupPayPalCampaignWebhook', {}));
    if (!request) return;
    setPaypalRegistering(true);
    setPaypalRegistrationStatus('');
    try {
      const response = await request;
      const data = response?.data || response;
      if (data?.ok !== true || data.webhook_registered !== true)
        throw new Error('PayPal did not confirm campaign webhook registration.');
      if (mounted.current) {
        setPaypalRegistrationStatus('PayPal confirmed the campaign webhook registration. Payment checkout remains disabled until sandbox acceptance tests pass.');
      }
      await runHealthCheck();
    } catch (error) {
      console.error('PayPal webhook registration failed:', error?.name || 'UnknownError');
      if (mounted.current) setPaypalRegistrationStatus('Campaign webhook registration needs attention. No payment or payout was started.');
    } finally {
      if (mounted.current) setPaypalRegistering(false);
    }
  };

  const sectionNavigation = (
    <nav aria-label="Admin integration sections" className="flex flex-wrap gap-2 mb-6">
      <Link to="/admin/integrations" aria-current={!aiView ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-semibold ${!aiView ? "bg-slate-900 text-white border-slate-900" : "bg-card text-foreground border-border hover:bg-muted"}`}>
        Provider integrations
      </Link>
      <Link to="/admin/integrations?view=ai" aria-current={aiView ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-semibold ${aiView ? "bg-slate-900 text-white border-slate-900" : "bg-card text-foreground border-border hover:bg-muted"}`}>
        AI Connections
      </Link>
      <Link to="/admin/agent-api" className="inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-semibold bg-card text-foreground border-border hover:bg-muted">External Agent API</Link>
    </nav>
  );

  if (!authReady) return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading integration registry</span></div>;

  if (!user) return <div className="max-w-6xl mx-auto px-4 py-10"><PageError message={SAFE_REGISTRY_ERROR} onRetry={reload} /></div>;

  if (!isAdminUser(user)) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6">
        <ShieldAlert className="w-10 h-10 text-stone-300 mx-auto" />
        <h1 className="font-display text-2xl text-stone-900 mt-4">Administrators only</h1>
        <p className="text-stone-500 mt-2">The integration registry is restricted to platform administrators.</p>
      </div>
    );
  }

  // External MCP clients share the existing OAuth consent backend.
  // This admin view reuses the prior Connect content without creating a new server or grants.
  if (aiView) return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
    {sectionNavigation}
    <AIConnections />
  </div>;

  if (registryError) return <div className="max-w-6xl mx-auto px-4 py-10">{sectionNavigation}<PageError message={registryError} onRetry={() => { setRegistryError(null); reload(); }} /></div>;
  if (!entries) return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading integration registry</span></div>;

  const visibleEntries = entries.filter((e) => String(e.platform || "").toLowerCase() !== "convex");
  const needsAttention = visibleEntries.filter((e) => e.status !== "ACTIVE");
  const counts = visibleEntries.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {sectionNavigation}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Integration Registry</h1>
          <p className="text-stone-500 mt-1">One secure source of truth for external-platform access — status, health, authorized agents, and reauthorization.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={inspectExistingPayPalWebhooks} disabled={paypalRegistering || checking} variant="outline" className="rounded-xl" aria-busy={paypalRegistering}>
            {paypalRegistering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
            Inspect existing PayPal webhooks
          </Button>
          <Button onClick={registerPayPalCampaignWebhook} disabled={paypalRegistering || checking || !paypalInventory || (paypalInventory.existing_count > 0 && paypalInventory.matching_count < 1)} variant="outline" className="rounded-xl" aria-busy={paypalRegistering}>
            {paypalRegistering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            {paypalRegistering ? "Verifying PayPal…" : "Register PayPal webhook"}
          </Button>
          <Button onClick={runHealthCheck} disabled={checking || paypalRegistering} className="rounded-xl" aria-busy={checking}>
            {checking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
            {checking ? "Checking…" : "Run health check"}
          </Button>
        </div>
      </div>

      {healthError && <div className="mt-4"><PageError message={healthError} onRetry={runHealthCheck} /></div>}
      {paypalRegistrationStatus && <p role="status" className="mt-3 text-sm text-amber-800">{paypalRegistrationStatus}</p>}
      {paypalInventory && (
        <section className="mt-3 rounded-xl border p-4" aria-label="Existing PayPal developer webhooks">
          <h3 className="font-semibold">Existing PayPal webhooks ({paypalInventory.existing_count})</h3>
          <p className="text-sm">Environment: {paypalInventory.environment}. Matching campaign callbacks: {paypalInventory.matching_count}. Existing registrations are never deleted or overwritten by inspection.</p>
          <ul className="mt-2 space-y-2 text-xs break-all">
            {paypalInventory.webhook_inventory.map((hook, index) => (
              <li key={hook.id || index} className="rounded-md border p-2">
                <strong>{hook.is_campaign_callback ? 'Campaign callback' : 'Other registered callback'}</strong>
                {' — '}{hook.url}
                {' — '}Event subscriptions: {(hook.event_types || []).length}
                {hook.has_required_campaign_events ? ' — Required campaign events present' : ''}
              </li>
            ))}
          </ul>
          {paypalInventory.existing_count > 0 && paypalInventory.matching_count === 0 && (
            <p className="mt-2 text-sm text-amber-800">No existing webhook matches this campaign receiver. New registration is blocked pending explicit review of the existing application webhooks.</p>
          )}
        </section>
      )}
      {paypalHealth && (
        <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="PayPal REST integration verification" role="status">
          <h2 className="text-base font-semibold text-amber-900">PayPal REST verification — {paypalHealth.status}</h2>
          <p className="text-sm text-amber-800 mt-1">Read-only provider checks. Passing OAuth alone does not enable donations or payouts.</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-950">
            {(Array.isArray(paypalHealth.checks) ? paypalHealth.checks : []).filter((check) => check.check?.startsWith('paypal_')).map((check, index) => (
              <li key={check.check + index}>{check.ok ? '✓' : '•'} {check.detail}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        <Stat label="Registered" value={visibleEntries.length} />
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
            {needsAttention.map((e) => {
              const badge = STATUS_BADGE[e.status] || UNKNOWN_STATUS_BADGE;
              return (
                <li key={e.id}>
                  <button onClick={() => setSelected(e)} className="underline-offset-2 hover:underline">{e.platform}</button>
                  {" — "}{badge.label}{e.last_failure ? " — provider verification requires attention" : ""}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Base44ReleaseStatus />
      <div className="mt-5"><AdminOAuthProviderReadiness /></div>
      <OwnerConnectorRoutePanel />
      <PayPalReceiptRecoveryPanel user={user} />

      <div className="mt-6">
        <IntegrationsTable entries={visibleEntries} onRowClick={setSelected} />
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
