import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import { ALL_PLATFORMS } from "./platformCatalog";
import { CONNECT_ACCOUNT_ORDER, ACCOUNT_ROW_COPY, SOCIAL_GATES, methodBadge, statusChip } from "./connectAccountRows";
import ConnectAccountRow from "./ConnectAccountRow";

// Every destination in one fixed list. Each row asks the backend what method it
// actually has, so the page never promises a route the platform cannot take.
export default function ConnectAccountsRows({ connections = [], onChoose, onNotice }) {
  const [methods, setMethods] = useState(null);
  const [readiness, setReadiness] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(CONNECT_ACCOUNT_ORDER.map((platform) =>
      base44.functions.invoke("discoverConnectionMethods", { platform, operation: "connect" })
        .then(({ data }) => [platform, data?.methods?.[0]?.method || ""])
        .catch(() => [platform, ""])
    )).then((entries) => { if (!cancelled) setMethods(Object.fromEntries(entries)); });

    base44.functions.invoke("getSocialOAuthReadiness", {})
      .then(({ data }) => {
        if (cancelled) return;
        const map = {};
        (data?.providers || []).forEach((provider) => { map[provider.platform] = provider; });
        setReadiness(map);
      })
      .catch(() => { if (!cancelled) setReadiness({}); });

    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => CONNECT_ACCOUNT_ORDER.map((platform) => {
    const meta = ALL_PLATFORMS.find((item) => item.id === platform);
    const connection = connections.find((item) => item.platform === platform) || null;
    const copy = ACCOUNT_ROW_COPY[platform] || null;
    const gate = SOCIAL_GATES[platform];
    const readinessRow = gate
      ? { button_label: `Connect ${meta?.name || platform}`, disabled_reason: readiness[platform]?.disabled_reason || gate, ...(readiness[platform] || {}) }
      : null;
    return {
      platform,
      name: meta?.name || platform,
      badge: methodBadge(platform, methods?.[platform], meta),
      chip: statusChip(connection),
      copy,
      readiness: readinessRow,
      checking: methods === null,
      connection,
    };
  }), [methods, readiness, connections]);

  return (
    <section className="mb-8" aria-labelledby="connect-accounts-heading">
      <h2 id="connect-accounts-heading" className="font-display text-xl text-stone-900 dark:text-white">Connect accounts</h2>
      <p className="text-sm text-muted-foreground mb-3">
        One row per platform. Only two fundraising platforms offer a real account connection today;
        the rest link a public campaign page or wait on provider approval.
      </p>
      {methods === null && (
        <p role="status" className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking available methods…
        </p>
      )}
      <div className="space-y-2">
        {rows.map((row) => (
          <ConnectAccountRow key={row.platform} row={row} onChoose={onChoose} onNotice={onNotice} />
        ))}
      </div>
    </section>
  );
}