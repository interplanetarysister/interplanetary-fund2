import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { CAPABILITY_MODULES } from "./onboardingSteps";
import { CheckCircle2, Clock, Link2, Loader2 } from "lucide-react";

const STATUS_META = {
  connected: { label: "Connected", icon: CheckCircle2, tone: "text-emerald-600" },
  setup_required: { label: "Setup required", icon: Link2, tone: "text-amber-600" },
  coming_soon: { label: "Coming soon", icon: Clock, tone: "text-stone-400" },
};

const CONNECTION_ID_BY_PLATFORM = {
  facebook: "facebook_pages",
  instagram: "instagram",
  tiktok: "tiktok",
  linkedin: "linkedin",
  stripe: "stripe",
  paypal: "paypal",
};

export default function ConnectStep({ data, onChange }) {
  const selected = data.platforms || [];
  const [connectedIds, setConnectedIds] = useState(new Set());
  const [loadingConnections, setLoadingConnections] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await base44.auth.me();
        const connections = await base44.entities.PlatformConnection.filter({
          created_by_id: me.id,
          status: "connected",
        });
        const ids = new Set(
          (connections || [])
            .map((connection) => CONNECTION_ID_BY_PLATFORM[connection.platform])
            .filter(Boolean)
        );
        if (!cancelled) setConnectedIds(ids);
      } catch (error) {
        console.error("ConnectStep connection-state lookup failed:", error);
        if (!cancelled) setConnectedIds(new Set());
      } finally {
        if (!cancelled) setLoadingConnections(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadingConnections) return;
    const normalized = selected.filter((id) => connectedIds.has(id));
    if (normalized.length !== selected.length) {
      onChange({ ...data, platforms: normalized });
    }
  }, [connectedIds, data, loadingConnections, onChange, selected]);

  const toggle = (id) => {
    if (!connectedIds.has(id)) return;
    const next = selected.includes(id)
      ? selected.filter((platform) => platform !== id)
      : [...selected, id];
    onChange({ ...data, platforms: next });
  };

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="font-display text-2xl text-stone-900 mb-2">
        Connect your fundraising world
      </h2>
      <p className="text-stone-600 mb-3">
        Choose the platforms you want to use. Connection state is based on your current
        authorized workspace connections, not a static availability claim.
      </p>
      <p className="text-sm text-stone-500 mb-6">
        Services marked <strong>Setup required</strong> need to be connected first from the
        Connections Center in the main navigation. Return here after connecting to select them.
      </p>
      {loadingConnections && (
        <p className="text-xs text-stone-500 mb-4 flex items-center gap-1.5" role="status" aria-live="polite">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          Checking connected services…
        </p>
      )}
      <div className="space-y-5">
        {CAPABILITY_MODULES.map((group) => (
          <div key={group.id}>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
              {group.group}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {group.items.map((item) => {
                const effectiveStatus = connectedIds.has(item.id) ? "connected" : item.status;
                const meta = STATUS_META[effectiveStatus];
                const Icon = meta.icon;
                const isSelected = selected.includes(item.id);
                const disabled = effectiveStatus !== "connected" || loadingConnections;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(item.id)}
                    aria-disabled={disabled}
                    aria-pressed={isSelected}
                    title={
                      effectiveStatus === "setup_required"
                        ? "Connect this service from the Connections Center first."
                        : effectiveStatus === "coming_soon"
                          ? "This service is not available yet."
                          : undefined
                    }
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <span className="text-stone-800">{item.label}</span>
                    <span className={`flex items-center gap-1 text-xs ${meta.tone}`}>
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
